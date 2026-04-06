/**
 * WorldCore 工单自动认领：空闲小人按距离认领 open 工单（与 GameOrchestrator 一帧内、tickSimulation 之前衔接）。
 * 锚格读条落成见 {@link tickAnchoredWorkProgress}。
 */

import { clearPawnIntent, describePawnDebugLabel, type PawnState } from "./pawn-state";
import type { WorldCore } from "./world-core-types";
import { cloneWorld } from "./world-internal";
import { workItemAnchorDurationSeconds } from "./work/work-item-duration";
import { claimWorkItem, completeWorkItem, failWorkItem } from "./work/work-operations";

function relabelWorkFields(pawn: PawnState): PawnState {
  return { ...pawn, debugLabel: describePawnDebugLabel(pawn) };
}

function manhattan(a: Readonly<{ col: number; row: number }>, b: Readonly<{ col: number; row: number }>): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function pawnHasClaimedWork(world: WorldCore, pawnId: string): boolean {
  for (const w of world.workItems.values()) {
    if (w.status === "claimed" && w.claimedBy === pawnId) return true;
  }
  return false;
}

/**
 * 可否参与 open 工单认领：不得已有 claimed 走向单、不得正在 use-target（吃睡娱乐）。
 * 不要求「未在移动」：游荡时每帧开始时常 `isMoving===true`，若仅此才不认领，
 * 则玩家放下新蓝图后工单会永远保持 open（小人一直在两格间闲逛）。
 * 认领时会清掉位移意图，当帧 `tickSimulation` 会改沿工单锚格行走。
 */
function canPawnAutoClaimOpenWork(world: WorldCore, pawn: PawnState): boolean {
  if (pawnHasClaimedWork(world, pawn.id)) return false;
  if (pawn.currentAction?.kind === "use-target") return false;
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
 * 对每条仍为 `open` 的工单，由可用小人按曼哈顿距离就近认领；每轮每个小人最多认领一条，小人 id 稳定排序。
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
    let bestId: string | undefined;
    let bestD = Infinity;
    for (const w of next.workItems.values()) {
      if (w.status !== "open" || w.claimedBy) continue;
      const d = manhattan(pawn.logicalCell, w.anchorCell);
      if (d < bestD) {
        bestD = d;
        bestId = w.id;
      }
    }
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
 * tickSimulation 之后：已认领工单且站在锚格上的小人对照 {@link workItemAnchorDurationSeconds} 累加读条，达标则落成工单。
 */
export function tickAnchoredWorkProgress(
  world: WorldCore,
  pawns: readonly PawnState[],
  simulationDt: number
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

    const duration = workItemAnchorDurationSeconds(claimed.kind);
    if (duration === undefined) {
      out.push(pawn);
      continue;
    }

    const atAnchor =
      pawn.logicalCell.col === claimed.anchorCell.col &&
      pawn.logicalCell.row === claimed.anchorCell.row;

    if (!atAnchor) {
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
    if (nextTimer >= duration) {
      const result = completeWorkItem(nextWorld, claimed.id, p.id);
      if (result.outcome.kind === "completed") {
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
