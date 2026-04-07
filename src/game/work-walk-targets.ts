/**
 * 认领工单后 sim-loop 的「操作站立格」选取与 `buildWorkWalkTargets` 映射（建造 / 拆除 / 伐木 / 拾取 / 搬运等走向类工单）。
 * 操作站立格为工单锚格（作用格）的四向可走邻格，小人不应占住锚格本身（该格往往不可通行）。
 * 锚格邻接读条落成由 {@link tickAnchoredWorkProgress} 处理。
 * 模块名 `work-walk-targets` 对应职责；非每帧 construct tick（旧名 world-construct-tick 易误导）。
 */

import { isWalkableCell, orthogonalNeighbors, type GridCoord, type WorldGridConfig } from "./map/world-grid";
import type { PawnState, PawnId } from "./pawn-state";
import type { WorldCore } from "./world-core-types";
import { WORK_WALK_KINDS } from "./work/work-item-duration";

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/**
 * 在锚格四邻中选取离 `fromCell` 曼哈顿距离最近的可走格；并列时按 (row, col) 稳定决胜。
 * 若无可走邻格则返回 `undefined`。
 */
export function pickWorkOperatorStandCell(
  grid: WorldGridConfig,
  anchor: GridCoord,
  fromCell: GridCoord
): GridCoord | undefined {
  const candidates = orthogonalNeighbors(grid, anchor).filter((c) => isWalkableCell(grid, c));
  if (candidates.length === 0) return undefined;

  let best = candidates[0]!;
  let bestD = manhattan(fromCell, best);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const d = manhattan(fromCell, c);
    if (
      d < bestD ||
      (d === bestD && (c.row < best.row || (c.row === best.row && c.col < best.col)))
    ) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/** 认领排序：小人到该工单最近可走操作邻格的距离；若无邻格则为 `Infinity`。 */
export function minManhattanToWorkOperatorStand(
  grid: WorldGridConfig,
  anchor: GridCoord,
  fromCell: GridCoord
): number {
  const op = pickWorkOperatorStandCell(grid, anchor, fromCell);
  if (!op) return Number.POSITIVE_INFINITY;
  return manhattan(fromCell, op);
}

export { WORK_WALK_KINDS };

/**
 * 已认领走向类工单：每人映射到当前帧应走向的「操作站立格」（锚格四邻可走格之一，就近选点）。
 */
export function buildWorkWalkTargets(
  world: WorldCore,
  pawns: readonly PawnState[]
): Map<PawnId, GridCoord> {
  const m = new Map<PawnId, GridCoord>();
  const pawnById = new Map(pawns.map((p) => [p.id, p] as const));
  for (const w of world.workItems.values()) {
    if (!WORK_WALK_KINDS.has(w.kind)) continue;
    if (w.status !== "claimed" || !w.claimedBy) continue;
    const pawn = pawnById.get(w.claimedBy);
    if (!pawn) continue;
    const stand = pickWorkOperatorStandCell(world.grid, w.anchorCell, pawn.logicalCell);
    if (stand) m.set(w.claimedBy, stand);
  }
  return m;
}
