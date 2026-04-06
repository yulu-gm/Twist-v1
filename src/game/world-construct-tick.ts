/**
 * WorldCore：认领工单后 sim-loop 走向锚格的目标映射（construct / 伐木 / 拾取 / 搬运）。
 * 锚格读条落成由 {@link tickAnchoredWorkProgress} 处理。
 */

import type { GridCoord } from "./map/world-grid";
import type { PawnId } from "./pawn-state";
import type { WorldCore } from "./world-core-types";
import type { WorkItemKind } from "./work/work-types";

/** 需要小人走向锚格再读条完成的工单种类（与 sim-loop 饥饿中断判定共用）。 */
export const WORK_WALK_KINDS: ReadonlySet<WorkItemKind> = new Set([
  "construct-blueprint",
  "chop-tree",
  "pick-up-resource",
  "haul-to-zone"
]);

/** 已认领工单锚格：construct / 伐木 / 拾取 / 搬运（与 sim-loop 走向工地逻辑共用）。 */
export function buildWorkWalkTargets(world: WorldCore): Map<PawnId, GridCoord> {
  const m = new Map<PawnId, GridCoord>();
  for (const w of world.workItems.values()) {
    if (!WORK_WALK_KINDS.has(w.kind)) continue;
    if (w.status !== "claimed" || !w.claimedBy) continue;
    m.set(w.claimedBy, w.anchorCell);
  }
  return m;
}
