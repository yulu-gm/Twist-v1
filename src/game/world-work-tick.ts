/**
 * WorldCore 工单自动认领：空闲小人按距离认领 open 工单（与 GameOrchestrator 一帧内、tickSimulation 之前衔接）。
 * 锚格读条落成见 {@link tickAnchoredWorkProgress}。
 */

import { canChooseNewGoal } from "./behavior/goal-driven-planning";
import { describePawnDebugLabel, type PawnState } from "./pawn-state";
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

/** 与 sim-loop 一致：可走新目标、未正在使用交互点、未已持有一条认领工单（含走向锚格途中）。 */
function isPawnIdleForWorkClaim(world: WorldCore, pawn: PawnState): boolean {
  if (!canChooseNewGoal(pawn)) return false;
  if (pawnHasClaimedWork(world, pawn.id)) return false;
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
 * 对每条仍为 `open` 且未被认领的工单，由空闲小人按曼哈顿距离就近认领；每工单最多一人，顺序按小人 id 稳定遍历。
 */
export function autoClaimOpenWorkItems(world: WorldCore, pawns: readonly PawnState[]): WorldCore {
  const candidates = pawns.filter((p) => isPawnIdleForWorkClaim(world, p)).sort((a, b) => a.id.localeCompare(b.id));
  let next = world;
  for (const pawn of candidates) {
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
    if (outcome.kind === "claimed") next = after;
  }
  return next;
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
