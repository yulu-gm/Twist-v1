import { describe, expect, it } from "vitest";
import {
  ALT_ENGLISH_NAME_POOL,
  DEFAULT_PAWN_NAMES,
  advanceMoveTowardTarget,
  beginMove,
  createDefaultPawnStates,
  finishMoveIfComplete,
  pickRandomAltPawnNames,
  pawnDisplayWorldCenter,
  smoothstep01
} from "../../src/game/pawn-state";
import { DEFAULT_WORLD_GRID, cellCenterWorld } from "../../src/game/world-grid";

describe("pawn-state", () => {
  it("creates five named pawns at spawn points", () => {
    const pawns = createDefaultPawnStates(DEFAULT_WORLD_GRID.defaultSpawnPoints);
    expect(pawns).toHaveLength(5);
    expect(pawns.map((p) => p.name)).toEqual([...DEFAULT_PAWN_NAMES]);
    for (let i = 0; i < pawns.length; i++) {
      expect(pawns[i]!.logicalCell).toEqual(DEFAULT_WORLD_GRID.defaultSpawnPoints[i]!);
    }
  });

  it("picks distinct alt names with deterministic rng", () => {
    const seq = [0.91, 0.12, 0.55, 0.03, 0.77, 0.4, 0.22, 0.66, 0.88, 0.01];
    let k = 0;
    const rng = () => seq[k++] ?? 0;
    const names = pickRandomAltPawnNames(5, rng);
    expect(names).toHaveLength(5);
    expect(new Set(names).size).toBe(5);
    for (const n of names) {
      expect(ALT_ENGLISH_NAME_POOL as readonly string[]).toContain(n);
    }
  });

  it("advances move progress and completes onto logical cell", () => {
    const [spawn] = DEFAULT_WORLD_GRID.defaultSpawnPoints;
    let p = createDefaultPawnStates([spawn!], ["T"])[0]!;
    p = beginMove(p, { col: spawn!.col + 1, row: spawn!.row });
    expect(p.moveTarget).toBeDefined();
    p = advanceMoveTowardTarget(p, 999, 1);
    expect(p.moveProgress01).toBe(1);
    p = finishMoveIfComplete(p);
    expect(p.moveTarget).toBeUndefined();
    expect(p.logicalCell).toEqual({ col: spawn!.col + 1, row: spawn!.row });
  });

  it("interpolates display position between cell centers", () => {
    const grid = DEFAULT_WORLD_GRID;
    const originX = 0;
    const originY = 0;
    const from = { col: 2, row: 2 };
    const to = { col: 3, row: 2 };
    let p = createDefaultPawnStates([from], ["T"])[0]!;
    p = beginMove(p, to);
    p = { ...p, moveProgress01: 0 };
    const a = pawnDisplayWorldCenter(p, grid, originX, originY);
    const b = pawnDisplayWorldCenter({ ...p, moveProgress01: 1 }, grid, originX, originY);
    const fromC = cellCenterWorld(grid, from, originX, originY);
    const toC = cellCenterWorld(grid, to, originX, originY);
    expect(a.x).toBeCloseTo(fromC.x, 5);
    expect(a.y).toBeCloseTo(fromC.y, 5);
    expect(b.x).toBeCloseTo(toC.x, 5);
    const mid = pawnDisplayWorldCenter({ ...p, moveProgress01: 0.5 }, grid, originX, originY);
    const t = smoothstep01(0.5);
    expect(mid.x).toBeCloseTo(fromC.x + (toC.x - fromC.x) * t, 5);
  });
});
