import { describe, expect, it } from "vitest";
import {
  legalWanderNeighbors,
  pickWanderTarget,
  type WanderRng
} from "../../src/game/behavior/wander-planning";
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

  it("excludes occupied neighbor cells for wandering", () => {
    const grid = DEFAULT_WORLD_GRID;
    const spawns = [...grid.defaultSpawnPoints];
    const pawns = createDefaultPawnStates(spawns);
    const occupied = logicalCellsByPawnId(pawns);
    const pawn0 = pawns[0]!;
    const legal = legalWanderNeighbors(grid, pawn0, occupied);
    for (const c of legal) {
      for (const other of pawns) {
        if (other.id === pawn0.id) continue;
        expect(c.col === other.logicalCell.col && c.row === other.logicalCell.row).toBe(
          false
        );
      }
    }
  });
});
