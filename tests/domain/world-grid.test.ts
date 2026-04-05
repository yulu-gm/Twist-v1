import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORLD_GRID,
  blockedKeysFromCells,
  coordKey,
  isCellOccupiedByOthers,
  isInsideGrid,
  isWalkableCell,
  orthogonalNeighbors,
  cellCenterWorld,
  pickRandomBlockedCells
} from "../../src/game/world-grid";

describe("world-grid", () => {
  it("exposes five default spawn points inside the grid", () => {
    const { defaultSpawnPoints, columns, rows } = DEFAULT_WORLD_GRID;
    expect(defaultSpawnPoints).toHaveLength(5);
    const seen = new Set<string>();
    for (const c of defaultSpawnPoints) {
      expect(isInsideGrid(DEFAULT_WORLD_GRID, c)).toBe(true);
      const k = coordKey(c);
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
    expect(columns).toBeGreaterThan(0);
    expect(rows).toBeGreaterThan(0);
  });

  it("enumerates orthogonal in-bounds neighbors", () => {
    const n = orthogonalNeighbors(DEFAULT_WORLD_GRID, { col: 0, row: 0 });
    expect(n).toEqual([
      { col: 1, row: 0 },
      { col: 0, row: 1 }
    ]);
    const inner = orthogonalNeighbors(DEFAULT_WORLD_GRID, { col: 5, row: 5 });
    expect(inner).toHaveLength(4);
  });

  it("converts cell center in world space with origin offset", () => {
    const { cellSizePx } = DEFAULT_WORLD_GRID;
    const p = cellCenterWorld(DEFAULT_WORLD_GRID, { col: 0, row: 0 }, 10, 20);
    expect(p.x).toBe(10 + cellSizePx / 2);
    expect(p.y).toBe(20 + cellSizePx / 2);
  });

  it("detects occupancy by other pawn logical cells", () => {
    const map = new Map([
      ["a", { col: 1, row: 1 }],
      ["b", { col: 2, row: 2 }]
    ]);
    expect(isCellOccupiedByOthers(map, { col: 1, row: 1 }, "a")).toBe(false);
    expect(isCellOccupiedByOthers(map, { col: 1, row: 1 }, "b")).toBe(true);
  });

  it("treats blocked cells as unwalkable", () => {
    const cell = { col: 3, row: 2 };
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: blockedKeysFromCells([cell])
    };
    expect(isWalkableCell(grid, cell)).toBe(false);
    expect(isWalkableCell(grid, { col: 4, row: 2 })).toBe(true);
  });

  it("pickRandomBlockedCells avoids excluded keys and caps by available space", () => {
    const exclude = new Set([coordKey({ col: 0, row: 0 }), coordKey({ col: 1, row: 0 })]);
    let i = 0;
    const rng = () => {
      const seq = [0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6];
      return seq[i++ % seq.length]!;
    };
    const stones = pickRandomBlockedCells(DEFAULT_WORLD_GRID, 5, exclude, rng);
    expect(stones).toHaveLength(5);
    const keys = new Set(stones.map(coordKey));
    for (const k of exclude) expect(keys.has(k)).toBe(false);
    for (const c of stones) expect(isInsideGrid(DEFAULT_WORLD_GRID, c)).toBe(true);
    const tiny = { ...DEFAULT_WORLD_GRID, columns: 2, rows: 1 };
    const few = pickRandomBlockedCells(tiny, 99, new Set(), () => 0.5);
    expect(few).toHaveLength(2);
  });
});
