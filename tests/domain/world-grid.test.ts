import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORLD_GRID,
  coordKey,
  isCellOccupiedByOthers,
  isInsideGrid,
  orthogonalNeighbors,
  cellCenterWorld
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
});
