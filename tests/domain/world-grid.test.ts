import { describe, expect, it } from "vitest";
import {
  blockedKeysFromCells,
  cellAtWorldPixel,
  cellCenterWorld,
  createReservationSnapshot,
  DEFAULT_WORLD_GRID,
  coordKey,
  rectCellKeysInclusive,
  isInteractionPointReservedByOther,
  isCellOccupiedByOthers,
  isInsideGrid,
  isWalkableCell,
  orthogonalNeighbors,
  pickRandomBlockedCells,
  reserveInteractionPoint,
  worldPointToCell
} from "../../src/game/map/world-grid";

describe("world-grid", () => {
  it("exposes five default spawn points inside the grid", () => {
    const { defaultSpawnPoints, columns, rows } = DEFAULT_WORLD_GRID;
    expect(defaultSpawnPoints).toHaveLength(5);
    const seen = new Set<string>();
    for (const cell of defaultSpawnPoints) {
      expect(isInsideGrid(DEFAULT_WORLD_GRID, cell)).toBe(true);
      const key = coordKey(cell);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
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

  it("maps world pixel to cell inside the grid only", () => {
    const ox = 100;
    const oy = 200;
    const cs = DEFAULT_WORLD_GRID.cellSizePx;
    expect(cellAtWorldPixel(DEFAULT_WORLD_GRID, ox, oy, ox, oy)).toEqual({
      col: 0,
      row: 0
    });
    expect(cellAtWorldPixel(DEFAULT_WORLD_GRID, ox, oy, ox + cs - 0.01, oy + cs - 0.01)).toEqual({
      col: 0,
      row: 0
    });
    expect(
      cellAtWorldPixel(DEFAULT_WORLD_GRID, ox, oy, ox + DEFAULT_WORLD_GRID.columns * cs, oy)
    ).toBe(null);
    expect(cellAtWorldPixel(DEFAULT_WORLD_GRID, ox, oy, ox - 1, oy)).toBe(null);
  });

  it("maps world points to in-bounds cells and rejects outside points", () => {
    const grid = DEFAULT_WORLD_GRID;
    const originX = 120;
    const originY = 80;
    const size = grid.cellSizePx;

    expect(
      worldPointToCell(grid, originX + size * 0.1, originY + size * 0.9, originX, originY)
    ).toEqual({
      col: 0,
      row: 0
    });
    expect(
      worldPointToCell(grid, originX + size * 1.2, originY + size * 2.1, originX, originY)
    ).toEqual({
      col: 1,
      row: 2
    });
    expect(worldPointToCell(grid, originX - 1, originY + size, originX, originY)).toBeUndefined();
    expect(
      worldPointToCell(grid, originX + grid.columns * size, originY + size, originX, originY)
    ).toBeUndefined();
    expect(
      worldPointToCell(grid, originX + size, originY + grid.rows * size, originX, originY)
    ).toBeUndefined();
  });

  it("expands inclusive rectangle keys between two cells in either drag direction", () => {
    const forward = rectCellKeysInclusive(
      DEFAULT_WORLD_GRID,
      { col: 2, row: 3 },
      { col: 4, row: 4 }
    );
    const reverse = rectCellKeysInclusive(
      DEFAULT_WORLD_GRID,
      { col: 4, row: 4 },
      { col: 2, row: 3 }
    );

    expect([...forward].sort()).toEqual([
      "2,3",
      "2,4",
      "3,3",
      "3,4",
      "4,3",
      "4,4"
    ]);
    expect([...reverse].sort()).toEqual([...forward].sort());
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
    for (const key of exclude) expect(keys.has(key)).toBe(false);
    for (const cell of stones) expect(isInsideGrid(DEFAULT_WORLD_GRID, cell)).toBe(true);
    const tiny = { ...DEFAULT_WORLD_GRID, columns: 2, rows: 1 };
    const few = pickRandomBlockedCells(tiny, 99, new Set(), () => 0.5);
    expect(few).toHaveLength(2);
  });

  it("provides default interaction points inside the grid", () => {
    const seen = new Set<string>();

    expect(DEFAULT_WORLD_GRID.interactionPoints.length).toBeGreaterThanOrEqual(5);
    for (const point of DEFAULT_WORLD_GRID.interactionPoints) {
      expect(isInsideGrid(DEFAULT_WORLD_GRID, point.cell)).toBe(true);
      expect(seen.has(point.id)).toBe(false);
      seen.add(point.id);
    }
  });

  it("supports single-slot reservations for interaction points", () => {
    const [point] = DEFAULT_WORLD_GRID.interactionPoints;
    const reservations = createReservationSnapshot();
    const reserved = reserveInteractionPoint(reservations, point!.id, "pawn-a");

    expect(reserved).toBeDefined();
    expect(isInteractionPointReservedByOther(reserved!, point!.id, "pawn-a")).toBe(false);
    expect(isInteractionPointReservedByOther(reserved!, point!.id, "pawn-b")).toBe(true);
    expect(reserveInteractionPoint(reserved!, point!.id, "pawn-b")).toBeUndefined();
  });
});
