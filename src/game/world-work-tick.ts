/**
 * WorldCore 工单自动认领：空闲小人按优先级与距离认领 open 工单（与 GameOrchestrator 一帧内、tickSimulation 之前衔接）。
 * 锚格读条落成见 {@link tickAnchoredWorkProgress}。
 *
 * **#0212**：open 工单的「候选排序键 + 认领资格」集中在本文件，命名与 {@link ./work/work-scheduler#getAvailableWork}
 * 对称；曼哈顿距离仅经 {@link selectBestOpenWorkItemForAutoClaim} 调用 {@link minManhattanToWorkOperatorStand}，
 * 与行走目标构造共用 `work-walk-targets`，避免启发式分叉维护。
 */

import type { SimConfig } from "./behavior/sim-config";
import { clearPawnIntent, describePawnDebugLabel, type PawnState } from "./pawn-state";
import type { WorldCore } from "./world-core-types";
import { cloneWorld } from "./world-internal";
import { workItemAnchorDurationSeconds } from "./work/work-item-duration";
import { claimWorkItem, completeWorkItem, failWorkItem } from "./work/work-operations";
import { minManhattanToWorkOperatorStand } from "./work-walk-targets";

function relabelWorkFields(pawn: PawnState): PawnState {
  return { ...pawn, debugLabel: describePawnDebugLabel(pawn) };
}

function manhattan(a: Readonly<{ col: number; row: number }>, b: Readonly<{ col: number; row: number }>): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/**
 * 开放工单认领择优：priority 降序 → 曼哈顿距离升序 → workId 字典序。
 * 与 `work-registry.sortWorkOrdersByPriorityDesc` / `oh-gen-doc/工作系统.yaml`「工作分配」一致。
 */
function isBetterOpenWorkClaim(
  cand: Readonly<{ id: string; priority: number; dist: number }>,
  best: Readonly<{ id: string; priority: number; dist: number }> | undefined
): boolean {
  if (!best) return true;
  if (cand.priority !== best.priority) return cand.priority > best.priority;
  if (cand.dist !== best.dist) return cand.dist < best.dist;
  return cand.id.localeCompare(best.id) < 0;
}

/**
 * 当前 `world` 下对该小人最优的 open 工单 id：priority 降序 → 操作站立格距离 → workId 字典序（与 {@link isBetterOpenWorkClaim} 一致）。
 */
function selectBestOpenWorkItemForAutoClaim(
  world: WorldCore,
  pawnLogicalCell: Readonly<{ col: number; row: number }>
): string | undefined {
  let best: { id: string; priority: number; dist: number } | undefined;
  for (const w of world.workItems.values()) {
    if (w.status !== "open" || w.claimedBy) continue;
    const dist = minManhattanToWorkOperatorStand(world.grid, w.anchorCell, pawnLogicalCell);
    const cand = { id: w.id, priority: w.priority, dist };
    if (isBetterOpenWorkClaim(cand, best)) best = cand;
  }
  return best?.id;
}

function pawnHasClaimedWork(world: WorldCore, pawnId: string): boolean {
  for (const w of world.workItems.values()) {
    if (w.status === "claimed" && w.claimedBy === pawnId) return true;
  }
  return false;
}

/**
 * 与 {@link ./work/work-scheduler#getAvailableWork} 对称：该小人是否允许进入「自动认领 open 工单」候选池。
 * 不得已有 claimed 走向单、不得正在 use-target（吃睡娱乐）。
 * 不要求「未在移动」：游荡时每帧开始时常 `isMoving===true`，若仅此才不认领，
 * 则玩家放下新蓝图后工单会永远保持 open（小人一直在两格间闲逛）。
 * 认领时会清掉位移意图，当帧 `tickSimulation` 会改沿锚格四邻操作站立格行走。
 */
function canPawnAutoClaimOpenWork(world: WorldCore, pawn: PawnState): boolean {
  if (pawnHasClaimedWork(world, pawn.id)) return false;
  if (pawn.currentAction?.kind === "use-target") return false;
  // 恢复中的 need-goal 不应被自动认领工单打断；巡游中的 wander 仍允许认领。
  if (pawn.currentGoal && pawn.currentGoal.kind !== "wander") return false;
  return true;
}

function deleteWorkItemAndDetach(world: WorldCore, workId: string): WorldCore {
  const work = world.workItems.get(workId);
  if (!work) return world;
  const next = cloneWorld(world);
  next.workItems.delete(workId);
  for (const [markerId, marker] of next.markers) {
    if (marker.workItemId === workId) next.markers.delete(markerId);
  }
  if (work.targetEntityId) {
    const ent = next.entities.get(work.targetEntityId);
    if (ent) {
      next.entities.set(work.targetEntityId, {
        ...ent,
        relatedWorkItemIds: ent.relatedWorkItemIds.filter((id) => id !== workId)
      });
    }
  }
  return next;
}

function targetEntityMissing(world: WorldCore, targetEntityId: string | undefined): boolean {
  return Boolean(targetEntityId && !world.entities.has(targetEntityId));
}

/**
 * 移除 `targetEntityId` 已不存在于 {@link WorldCore.entities} 的工单：`claimed` 先 {@link failWorkItem}（stale-target），
 * 再删单并解绑引用；`open` 直接删单。同步清除小人的 `activeWorkItemId` / `workTimerSec`。
 */
export function cleanupStaleTargetWorkItems(
  world: WorldCore,
  pawns: readonly PawnState[]
): Readonly<{ world: WorldCore; pawns: PawnState[]; changed: boolean }> {
  const stale = [...world.workItems.values()].filter(
    (w) =>
      (w.status === "open" || w.status === "claimed") && targetEntityMissing(world, w.targetEntityId)
  );
  if (stale.length === 0) {
    return { world, pawns: [...pawns], changed: false };
  }

  let next = world;
  const pawnsToClear = new Set<string>();

  for (const w of stale) {
    if (w.status === "claimed" && w.claimedBy) {
      const { world: afterFail, outcome } = failWorkItem(next, w.id, w.claimedBy, "stale-target");
      if (outcome.kind === "failed") {
        next = afterFail;
        pawnsToClear.add(w.claimedBy);
      }
    }
  }

  const stillStale = [...next.workItems.values()].filter(
    (w) =>
      (w.status === "open" || w.status === "claimed") && targetEntityMissing(next, w.targetEntityId)
  );
  for (const w of stillStale) {
    next = deleteWorkItemAndDetach(next, w.id);
  }

  const nextPawns = pawns.map((p) => {
    const clearedStale = pawnsToClear.has(p.id);
    const orphaned =
      p.activeWorkItemId !== undefined &&
      !next.workItems.has(p.activeWorkItemId);
    if (!clearedStale && !orphaned) return p;
    return relabelWorkFields({
      ...p,
      activeWorkItemId: undefined,
      workTimerSec: 0
    });
  });

  return { world: next, pawns: nextPawns, changed: true };
}

/**
 * 对每条仍为 `open` 的工单，由可用小人认领：先按工单 `priority` 从高到低，同优先级再按曼哈顿距离就近，再以 workId 稳定决胜；
 * 每轮每个小人最多认领一条，小人 id 稳定排序。
 * 认领成功时会打断游荡位移并清空工单读条字段，避免与新建认领不同步。
 */
export function autoClaimOpenWorkItems(
  world: WorldCore,
  pawns: readonly PawnState[]
): Readonly<{ world: WorldCore; pawns: readonly PawnState[] }> {
  const sorted = [...pawns].sort((a, b) => a.id.localeCompare(b.id));
  let next = world;
  const clearedIds = new Set<string>();

  for (const pawn of sorted) {
    if (!canPawnAutoClaimOpenWork(next, pawn)) continue;
    const bestId = selectBestOpenWorkItemForAutoClaim(next, pawn.logicalCell);
    if (bestId === undefined) continue;
    const { world: after, outcome } = claimWorkItem(next, bestId, pawn.id);
    if (outcome.kind === "claimed") {
      next = after;
      clearedIds.add(pawn.id);
    }
  }

  if (clearedIds.size === 0) {
    return { world: next, pawns };
  }

  const nextPawns = pawns.map((p) => {
    if (!clearedIds.has(p.id)) return p;
    return relabelWorkFields(
      clearPawnIntent({
        ...p,
        moveTarget: undefined,
        moveProgress01: 0,
        activeWorkItemId: undefined,
        workTimerSec: 0
      })
    );
  });
  return { world: next, pawns: nextPawns };
}

/**
 * tickSimulation 之后：已认领工单且与锚格四向邻接的小人对照 {@link workItemAnchorDurationSeconds} 与 `timings` 累加读条，达标则落成工单。
 */
export function tickAnchoredWorkProgress(
  world: WorldCore,
  pawns: readonly PawnState[],
  simulationDt: number,
  timings: Pick<SimConfig, "workItemAnchorDurationSec">
): { world: WorldCore; pawns: PawnState[] } {
  let nextWorld = world;
  const out: PawnState[] = [];

  for (const pawn of pawns) {
    const claimed = [...nextWorld.workItems.values()].find(
      (w) => w.status === "claimed" && w.claimedBy === pawn.id
    );

    if (!claimed) {
      if (pawn.workTimerSec !== 0 || pawn.activeWorkItemId !== undefined) {
        out.push(
          relabelWorkFields({
            ...pawn,
            workTimerSec: 0,
            activeWorkItemId: undefined
          })
        );
      } else {
        out.push(pawn);
      }
      continue;
    }

    const duration = workItemAnchorDurationSeconds(timings.workItemAnchorDurationSec, claimed.kind);
    const orthoAdjacentToAnchor =
      manhattan(pawn.logicalCell, claimed.anchorCell) === 1;

    // 零/负读条（配置为 0 或未来扩展）：邻接锚格仍应落成，避免 deconstruct-obstacle 等工单永无完成路径。
    if (!(duration > 0)) {
      if (orthoAdjacentToAnchor) {
        let p = pawn;
        if (p.activeWorkItemId !== claimed.id) {
          p = relabelWorkFields({
            ...p,
            activeWorkItemId: claimed.id,
            workTimerSec: 0
          });
        }
        const result = completeWorkItem(nextWorld, claimed.id, p.id, { pawns });
        if (result.outcome.kind === "completed" || result.outcome.kind === "haul-reopened") {
          nextWorld = result.world;
          out.push(
            relabelWorkFields({
              ...p,
              workTimerSec: 0,
              activeWorkItemId: undefined
            })
          );
        } else {
          out.push(relabelWorkFields(p));
        }
      } else if (pawn.workTimerSec !== 0 || pawn.activeWorkItemId !== undefined) {
        out.push(
          relabelWorkFields({
            ...pawn,
            workTimerSec: 0,
            activeWorkItemId: undefined
          })
        );
      } else {
        out.push(pawn);
      }
      continue;
    }

    if (!orthoAdjacentToAnchor) {
      if (pawn.workTimerSec !== 0 || pawn.activeWorkItemId !== undefined) {
        out.push(
          relabelWorkFields({
            ...pawn,
            workTimerSec: 0,
            activeWorkItemId: undefined
          })
        );
      } else {
        out.push(pawn);
      }
      continue;
    }

    let p = pawn;
    if (p.activeWorkItemId !== claimed.id) {
      p = relabelWorkFields({
        ...p,
        activeWorkItemId: claimed.id,
        workTimerSec: 0
      });
    }

    const nextTimer = p.workTimerSec + simulationDt;

    if (claimed.kind === "construct-blueprint" && claimed.targetEntityId && duration > 0) {
      const progress01 = nextTimer >= duration ? 1 : Math.min(1, nextTimer / duration);
      const bp = nextWorld.entities.get(claimed.targetEntityId);
      const priorProgress = bp?.kind === "blueprint" ? (bp.buildProgress01 ?? 0) : 0;
      if (bp?.kind === "blueprint" && priorProgress < progress01 - 1e-9) {
        nextWorld = cloneWorld(nextWorld);
        const cur = nextWorld.entities.get(claimed.targetEntityId);
        if (cur?.kind === "blueprint") {
          const buildState =
            progress01 >= 1 ? "completed" : progress01 > 0 ? "in-progress" : ("planned" as const);
          nextWorld.entities.set(cur.id, {
            ...cur,
            buildProgress01: progress01,
            buildState
          });
        }
      }
    }

    if (nextTimer >= duration) {
      const result = completeWorkItem(nextWorld, claimed.id, p.id, { pawns });
      if (result.outcome.kind === "completed" || result.outcome.kind === "haul-reopened") {
        nextWorld = result.world;
        out.push(
          relabelWorkFields({
            ...p,
            workTimerSec: 0,
            activeWorkItemId: undefined
          })
        );
      } else {
        out.push(relabelWorkFields({ ...p, workTimerSec: nextTimer }));
      }
    } else {
      out.push(relabelWorkFields({ ...p, workTimerSec: nextTimer }));
    }
  }

  return { world: nextWorld, pawns: out };
}
