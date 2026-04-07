import type { GridCoord, WorldGridConfig } from "./world-grid";
import { coordKey, isWalkableCell, orthogonalNeighbors } from "./world-grid";

function manhattanDistance(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function reconstructPath(
  cameFrom: ReadonlyMap<string, string>,
  start: GridCoord,
  goal: GridCoord
): GridCoord[] {
  const keys: string[] = [];
  let currentKey = coordKey(goal);
  const startKey = coordKey(start);

  while (currentKey !== startKey) {
    keys.push(currentKey);
    const previous = cameFrom.get(currentKey);
    if (!previous) return [];
    currentKey = previous;
  }

  keys.reverse();
  return keys
    .map((key) => {
      const comma = key.indexOf(",");
      return {
        col: Number(key.slice(0, comma)),
        row: Number(key.slice(comma + 1))
      };
    })
    .filter((cell) => Number.isInteger(cell.col) && Number.isInteger(cell.row));
}

function orderedNeighbors(
  grid: WorldGridConfig,
  current: GridCoord,
  goal: GridCoord
): GridCoord[] {
  return orthogonalNeighbors(grid, current)
    .filter((cell) => isWalkableCell(grid, cell))
    .sort((left, right) => {
      const hDiff = manhattanDistance(left, goal) - manhattanDistance(right, goal);
      if (hDiff !== 0) return hDiff;
      const rowDiff = left.row - right.row;
      if (rowDiff !== 0) return rowDiff;
      return left.col - right.col;
    });
}

/** 在静态可走格障碍图上求最短步路径（地图侧路径查询）。 */
export function findPathAStar(
  grid: WorldGridConfig,
  start: GridCoord,
  goal: GridCoord
): GridCoord[] | undefined {
  if (!isWalkableCell(grid, start)) return undefined;
  if (!isWalkableCell(grid, goal)) return undefined;
  if (start.col === goal.col && start.row === goal.row) return [];

  const startKey = coordKey(start);
  const goalKey = coordKey(goal);
  const openSet = new Set<string>([startKey]);
  const openCells = new Map<string, GridCoord>([[startKey, start]]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, manhattanDistance(start, goal)]]);

  while (openSet.size > 0) {
    let currentKey: string | undefined;
    let currentCell: GridCoord | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const key of openSet) {
      const score = fScore.get(key) ?? Number.POSITIVE_INFINITY;
      if (score > bestScore) continue;
      const cell = openCells.get(key)!;
      if (
        score < bestScore ||
        !currentCell ||
        cell.row < currentCell.row ||
        (cell.row === currentCell.row && cell.col < currentCell.col)
      ) {
        bestScore = score;
        currentKey = key;
        currentCell = cell;
      }
    }

    if (!currentKey || !currentCell) break;
    if (currentKey === goalKey) {
      return reconstructPath(cameFrom, start, goal);
    }

    openSet.delete(currentKey);
    openCells.delete(currentKey);

    for (const neighbor of orderedNeighbors(grid, currentCell, goal)) {
      const neighborKey = coordKey(neighbor);
      const tentativeScore = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + 1;
      if (tentativeScore >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;

      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentativeScore);
      fScore.set(neighborKey, tentativeScore + manhattanDistance(neighbor, goal));
      openSet.add(neighborKey);
      openCells.set(neighborKey, neighbor);
    }
  }

  return undefined;
}
