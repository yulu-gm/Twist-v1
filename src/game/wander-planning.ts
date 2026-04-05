/** task-planning（游荡）：从合法邻格中选下一个目标，随机源可注入。 */

import type { GridCoord, WorldGridConfig } from "./world-grid";
import { isWalkableCell, isCellOccupiedByOthers, orthogonalNeighbors } from "./world-grid";
import type { PawnId, PawnState } from "./pawn-state";

/** 返回 [0, 1) 的伪随机数，便于测试注入固定序列。 */
export type WanderRng = () => number;

export type WanderDecision =
  | Readonly<{ kind: "move"; target: GridCoord }>
  | Readonly<{ kind: "wait" }>;

export function legalWanderNeighbors(
  grid: WorldGridConfig,
  pawn: PawnState,
  logicalCellsByPawnId: ReadonlyMap<PawnId, GridCoord>
): GridCoord[] {
  const base = orthogonalNeighbors(grid, pawn.logicalCell);
  return base.filter((cell) => {
    if (!isWalkableCell(grid, cell)) return false;
    if (isCellOccupiedByOthers(logicalCellsByPawnId, cell, pawn.id)) return false;
    return true;
  });
}

export function pickWanderTarget(
  rng: WanderRng,
  candidates: readonly GridCoord[]
): WanderDecision {
  if (candidates.length === 0) return { kind: "wait" };
  const idx = Math.floor(rng() * candidates.length);
  const target = candidates[idx]!;
  return { kind: "move", target };
}
