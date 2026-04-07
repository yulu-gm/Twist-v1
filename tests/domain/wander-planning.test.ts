import { describe, expect, it } from "vitest";
import {
  legalWanderNeighbors,
  pickWanderTarget,
  type WanderRng
} from "../../src/game/behavior/wander-planning";
import { chooseWanderPath } from "../../src/game/behavior/goal-driven-planning";
import { createDefaultPawnStates, logicalCellsByPawnId } from "../../src/game/pawn-state";
import { blockedKeysFromCells, coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";

describe("wander-planning", () => {
  it("picks first candidate when rng always returns 0", () => {
    const rng: WanderRng = () => 0;
    const candidates = [
      { col: 1, row: 0 },
      { col: 0, row: 1 }
    ];
    const d = pickWanderTarget(rng, candidates);
    expect(d).toEqual({ kind: "move", target: candidates[0] });
  });

  it("returns wait when no legal neighbors", () => {
    const rng: WanderRng = () => 0.5;
    expect(pickWanderTarget(rng, [])).toEqual({ kind: "wait" });
  });

  it("excludes blocked neighbor cells for wandering", () => {
    const base = DEFAULT_WORLD_GRID;
    const neighbor = {
      col: base.defaultSpawnPoints[0]!.col + 1,
      row: base.defaultSpawnPoints[0]!.row
    };
    const grid = {
      ...base,
      blockedCellKeys: blockedKeysFromCells([neighbor])
    };
    const spawns = [...grid.defaultSpawnPoints];
    const pawns = createDefaultPawnStates(spawns);
    const pawn0 = pawns[0]!;
    const occupied = logicalCellsByPawnId(pawns);
    const legal = legalWanderNeighbors(grid, pawn0, occupied);
    expect(legal.some((c) => coordKey(c) === coordKey(neighbor))).toBe(false);
  });

  it("keeps occupied neighbor cells legal for wandering", () => {
    const grid = DEFAULT_WORLD_GRID;
    const pawns = createDefaultPawnStates(
      [
        { col: 4, row: 3 },
        { col: 5, row: 3 }
      ],
      ["A", "B"]
    );
    const occupied = logicalCellsByPawnId(pawns);
    const pawn0 = pawns[0]!;
    const legal = legalWanderNeighbors(grid, pawn0, occupied);
    expect(legal).toContainEqual(pawns[1]!.logicalCell);
  });

  it("chooseWanderPath picks a random legal neighbor and returns a single-step path", () => {
    const rng: WanderRng = () => 0.99;
    const pawn = createDefaultPawnStates([{ col: 5, row: 5 }], ["T"])[0]!;
    const occupied = logicalCellsByPawnId([pawn]);
    const path = chooseWanderPath(DEFAULT_WORLD_GRID, pawn, occupied, rng);

    expect(path).toBeDefined();
    expect(path).toHaveLength(1);
    const step = path![0]!;
    expect(Math.abs(step.col - pawn.logicalCell.col) + Math.abs(step.row - pawn.logicalCell.row)).toBe(
      1
    );
  });

  it("chooseWanderPath returns undefined when no other reachable walkable cell exists", () => {
    const rng: WanderRng = () => 0.25;
    const pawn = createDefaultPawnStates([{ col: 1, row: 1 }], ["T"])[0]!;
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: blockedKeysFromCells([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
        { col: 0, row: 1 },
        { col: 2, row: 1 },
        { col: 0, row: 2 },
        { col: 1, row: 2 },
        { col: 2, row: 2 }
      ])
    };

    expect(chooseWanderPath(grid, pawn, logicalCellsByPawnId([pawn]), rng)).toBeUndefined();
  });
});
