import { describe, expect, it } from "vitest";
import { astarNextStepTowardCell } from "../src/game/grid-pathfinding";
import {
  blockedKeysFromCells,
  isCellOccupiedByOthers,
  isWalkableCell,
  orthogonalNeighbors,
  type GridCoord,
  type WorldGridConfig
} from "../src/game/world-grid";

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function greedyNextStep(
  grid: WorldGridConfig,
  start: GridCoord,
  target: GridCoord,
  logicalCellsByPawnId: ReadonlyMap<string, GridCoord>,
  selfId: string
): GridCoord | undefined {
  if (start.col === target.col && start.row === target.row) return undefined;
  return orthogonalNeighbors(grid, start)
    .filter(
      (cell) =>
        isWalkableCell(grid, cell) && !isCellOccupiedByOthers(logicalCellsByPawnId, cell, selfId)
    )
    .sort((left, right) => manhattan(left, target) - manhattan(right, target))[0];
}

describe("astarNextStepTowardCell", () => {
  const baseGrid = (): WorldGridConfig => ({
    columns: 3,
    rows: 3,
    cellSizePx: 48,
    defaultSpawnPoints: []
  });

  it("returns first step on a shortest orth path", () => {
    const grid = baseGrid();
    const logical = new Map<string, GridCoord>([["p1", { col: 0, row: 2 }]]);
    const step = astarNextStepTowardCell(grid, { col: 0, row: 2 }, { col: 2, row: 2 }, logical, "p1");
    expect(step).toEqual({ col: 1, row: 2 });
  });

  it("avoids greedy backtrack in a concave blocked layout", () => {
    const grid: WorldGridConfig = {
      ...baseGrid(),
      blockedCellKeys: blockedKeysFromCells([
        { col: 1, row: 1 },
        { col: 1, row: 2 }
      ])
    };
    const start: GridCoord = { col: 0, row: 1 };
    const goal: GridCoord = { col: 2, row: 2 };
    const logical = new Map<string, GridCoord>([["p1", start]]);
    const greedy = greedyNextStep(grid, start, goal, logical, "p1");
    const astar = astarNextStepTowardCell(grid, start, goal, logical, "p1");
    expect(greedy).toEqual({ col: 0, row: 2 });
    expect(astar).toEqual({ col: 0, row: 0 });
  });

  it("returns undefined when target is occupied by another pawn", () => {
    const grid = baseGrid();
    const logical = new Map<string, GridCoord>([
      ["p1", { col: 0, row: 1 }],
      ["p2", { col: 2, row: 2 }]
    ]);
    const step = astarNextStepTowardCell(grid, { col: 0, row: 1 }, { col: 2, row: 2 }, logical, "p1");
    expect(step).toBeUndefined();
  });

  it("returns undefined when no orthogonal path exists", () => {
    const grid: WorldGridConfig = {
      ...baseGrid(),
      columns: 3,
      rows: 2,
      blockedCellKeys: blockedKeysFromCells([
        { col: 1, row: 0 },
        { col: 1, row: 1 }
      ])
    };
    const logical = new Map<string, GridCoord>([["p1", { col: 0, row: 0 }]]);
    const step = astarNextStepTowardCell(grid, { col: 0, row: 0 }, { col: 2, row: 0 }, logical, "p1");
    expect(step).toBeUndefined();
  });

  it("returns undefined when already at goal", () => {
    const grid = baseGrid();
    const c: GridCoord = { col: 1, row: 1 };
    const logical = new Map<string, GridCoord>([["p1", c]]);
    expect(astarNextStepTowardCell(grid, c, c, logical, "p1")).toBeUndefined();
  });
});
