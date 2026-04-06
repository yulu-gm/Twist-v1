/**
 * refactor-test：保留回归（床位认领直连），WORK-004 / BUILD-002 / BUILD-004 主证据以对应场景 expectations
 * + `bed-overflow-unassigned.test.ts` 等场景级用例 + `scenario-runner.test.ts` 为准。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map";
import { createHeadlessSim } from "../../src/headless";
import { resetDomainCommandIdSequence } from "../../src/player/build-domain-command";
import {
  BED_AUTO_ASSIGN_SCENARIO,
  BED_BLUEPRINT_CELL
} from "../../scenarios/bed-auto-assign.scenario";

describe("BUILD-002 bed auto assignment", () => {
  beforeEach(() => {
    resetDomainCommandIdSequence();
  });

  it("assigns the finished bed to one pawn only after the player places it through the build tool", () => {
    const sim = createHeadlessSim({ seed: BED_AUTO_ASSIGN_SCENARIO.seed });
    const [spawnA, spawnB] = DEFAULT_WORLD_GRID.defaultSpawnPoints;
    sim.spawnPawn("Worker", spawnA!);
    sim.spawnPawn("Idle", spawnB!);

    const outcome = sim.commitPlayerSelection({
      toolId: "build",
      selectionModifier: "replace",
      cellKeys: new Set([coordKey(BED_BLUEPRINT_CELL)]),
      inputShape: "single-cell",
      currentMarkers: new Map(),
      nowMs: 0
    });

    expect(outcome.didSubmitToWorld).toBe(true);
    expect(outcome.command?.verb).toBe("place_furniture:bed");
    expect(outcome.submitResult?.accepted).toBe(true);

    const completed = sim.runUntil(() => {
      const world = sim.getWorldPort().getWorld();
      const bed = [...world.entities.values()].find(
        (entity) =>
          entity.kind === "building" &&
          entity.buildingKind === "bed" &&
          entity.cell.col === BED_BLUEPRINT_CELL.col &&
          entity.cell.row === BED_BLUEPRINT_CELL.row
      );
      if (!bed) {
        return false;
      }

      const spot = world.restSpots.find((restSpot) => restSpot.buildingEntityId === bed.id);
      return spot?.ownerPawnId !== undefined;
    }, { maxTicks: 20_000, deltaMs: 16 });

    expect(completed.reachedPredicate).toBe(true);

    const world = sim.getWorldPort().getWorld();
    const bedEntity = [...world.entities.values()].find(
      (entity) =>
        entity.kind === "building" &&
        entity.buildingKind === "bed" &&
        entity.cell.col === BED_BLUEPRINT_CELL.col &&
        entity.cell.row === BED_BLUEPRINT_CELL.row
    );
    expect(bedEntity).toBeDefined();

    const restSpot = world.restSpots.find((spot) => spot.buildingEntityId === bedEntity!.id);
    expect(restSpot).toBeDefined();
    expect(restSpot!.ownerPawnId).toBeDefined();
    expect(bedEntity!.ownership?.ownerPawnId).toBe(restSpot!.ownerPawnId);

    const pawnIds = new Set(sim.getPawns().map((pawn) => pawn.id));
    expect(pawnIds.has(restSpot!.ownerPawnId!)).toBe(true);
    expect(world.restSpots.filter((spot) => spot.ownerPawnId !== undefined)).toHaveLength(1);
  });
});
