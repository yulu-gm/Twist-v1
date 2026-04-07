import type { PawnId } from "./pawn-state";
import {
  coordKey,
  gridCoordFromKey,
  isCellOccupiedByOthers,
  isWalkableCell,
  orthogonalNeighbors,
  type GridCoord,
  type WorldGridConfig
} from "./world-grid";

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

export function astarNextStepTowardCell(
  grid: WorldGridConfig,
  start: GridCoord,
  targetCell: GridCoord,
  logicalCellsByPawnId: ReadonlyMap<PawnId, GridCoord>,
  selfPawnId: string
): GridCoord | undefined {
  if (start.col === targetCell.col && start.row === targetCell.row) {
    return undefined;
  }

  const startKey = coordKey(start);
  const goalKey = coordKey(targetCell);

  const traversable = (cell: GridCoord): boolean => {
    if (!isWalkableCell(grid, cell)) return false;
    if (isCellOccupiedByOthers(logicalCellsByPawnId, cell, selfPawnId)) return false;
    return true;
  };

  if (!traversable(targetCell)) return undefined;
  if (!traversable(start)) return undefined;

  const gScore = new Map<string, number>([[startKey, 0]]);
  const cameFrom = new Map<string, string>();
  const openKeys: string[] = [startKey];

  const h = (key: string): number => {
    const c = gridCoordFromKey(key);
    if (!c) return 0;
    return manhattan(c, targetCell);
  };

  const fScore = (key: string): number => (gScore.get(key) ?? Infinity) + h(key);

  const closed = new Set<string>();

  while (openKeys.length > 0) {
    let bestIdx = 0;
    let bestKey = openKeys[0]!;
    let bestF = fScore(bestKey);
    let bestH = h(bestKey);
    for (let i = 1; i < openKeys.length; i++) {
      const k = openKeys[i]!;
      const f = fScore(k);
      const hv = h(k);
      if (
        f < bestF ||
        (f === bestF && (hv < bestH || (hv === bestH && k < bestKey)))
      ) {
        bestF = f;
        bestH = hv;
        bestKey = k;
        bestIdx = i;
      }
    }
    openKeys.splice(bestIdx, 1);

    if (bestKey === goalKey) {
      let cur = goalKey;
      const rev: string[] = [cur];
      while (cur !== startKey) {
        const p = cameFrom.get(cur);
        if (!p) return undefined;
        cur = p;
        rev.push(cur);
      }
      rev.reverse();
      if (rev.length < 2) return undefined;
      const stepKey = rev[1]!;
      const step = gridCoordFromKey(stepKey);
      return step;
    }

    closed.add(bestKey);
    const curCell = gridCoordFromKey(bestKey);
    if (!curCell) continue;

    const curG = gScore.get(bestKey) ?? Infinity;
    for (const nb of orthogonalNeighbors(grid, curCell)) {
      const nk = coordKey(nb);
      if (closed.has(nk)) continue;
      if (!traversable(nb)) continue;

      const tentativeG = curG + 1;
      const prevG = gScore.get(nk);
      if (prevG === undefined || tentativeG < prevG) {
        cameFrom.set(nk, bestKey);
        gScore.set(nk, tentativeG);
        if (!openKeys.includes(nk)) {
          openKeys.push(nk);
        }
      }
    }
  }

  return undefined;
}
