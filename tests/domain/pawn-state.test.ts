import { describe, expect, it } from "vitest";
import { advanceNeeds, applyNeedDelta } from "../../src/game/need/need-utils";
import {
  ALT_ENGLISH_NAME_POOL,
  DEFAULT_PAWN_NAMES,
  advanceMoveTowardTarget,
  beginMove,
  createDefaultPawnStates,
  describePawnDebugLabel,
  finishMoveIfComplete,
  pickRandomAltPawnNames,
  pawnDisplayWorldCenter,
  setPawnIntent,
  smoothstep01
} from "../../src/game/pawn-state";
import { DEFAULT_WORLD_GRID, cellCenterWorld } from "../../src/game/map/world-grid";

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

  it("advances needs over time and clamps them to 100", () => {
    const [spawn] = DEFAULT_WORLD_GRID.defaultSpawnPoints;
    const pawn = createDefaultPawnStates([spawn!], ["T"])[0]!;
    const updated = advanceNeeds(pawn, 20, {
      hunger: 10,
      rest: 5,
      recreation: 6
    });

    expect(updated.needs).toEqual({
      hunger: 100,
      rest: 100,
      recreation: 100
    });
    expect(updated.satiety).toBe(0);
    expect(updated.energy).toBe(0);
  });

  it("satiety 随饥饿速率递减且 needs.hunger 由饱食度派生", () => {
    const [spawn] = DEFAULT_WORLD_GRID.defaultSpawnPoints;
    const pawn = createDefaultPawnStates([spawn!], ["T"])[0]!;
    const updated = advanceNeeds(pawn, 10, {
      hunger: 2,
      rest: 0,
      recreation: 0
    });
    expect(updated.satiety).toBe(80);
    expect(updated.needs.hunger).toBe(40);
  });

  it("energy 随休息速率递减且 needs.rest 由精力派生", () => {
    const [spawn] = DEFAULT_WORLD_GRID.defaultSpawnPoints;
    const pawn = createDefaultPawnStates([spawn!], ["T"])[0]!;
    const updated = advanceNeeds(pawn, 10, {
      hunger: 0,
      rest: 3,
      recreation: 0
    });
    expect(updated.energy).toBe(70);
    expect(updated.needs.rest).toBe(40);
  });

  it("applies need deltas and clamps them to zero", () => {
    const [spawn] = DEFAULT_WORLD_GRID.defaultSpawnPoints;
    const pawn = createDefaultPawnStates([spawn!], ["T"])[0]!;
    const updated = applyNeedDelta(pawn, {
      hunger: -200,
      rest: -10,
      recreation: 5
    });

    expect(updated.needs).toEqual({
      hunger: 20,
      rest: 10,
      recreation: 25
    });
  });

  it("builds a stable debug label from the current goal and action", () => {
    const [spawn] = DEFAULT_WORLD_GRID.defaultSpawnPoints;
    const pawn = setPawnIntent(
      createDefaultPawnStates([spawn!], ["T"])[0]!,
      {
        kind: "eat",
        reason: "hunger-high",
        targetId: "food-1"
      },
      {
        kind: "move-to-target",
        targetId: "food-1"
      },
      "food-1"
    );

    expect(describePawnDebugLabel(pawn)).toBe("goal:eat action:move-to-target target:food-1");
    expect(pawn.debugLabel).toBe("goal:eat action:move-to-target target:food-1");
  });
});
