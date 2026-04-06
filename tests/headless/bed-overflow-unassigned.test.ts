/**
 * refactor-test：BUILD-004 场景级主验收入口（床位溢出仍保留未分配床）。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map";
import { createHeadlessSim } from "../../src/headless";
import { resetDomainCommandIdSequence } from "../../src/player/build-domain-command";
import { BED_OVERFLOW_CELLS } from "../../scenarios/bed-overflow-unassigned.scenario";

describe("BUILD-004 bed overflow remains unassigned", () => {
  beforeEach(() => {
    resetDomainCommandIdSequence();
  });

  it("builds every placed bed through the build tool and leaves exactly one extra bed without an owner", () => {
    const sim = createHeadlessSim({ seed: 0x42_55_49_34 });
    const [spawnA, spawnB] = DEFAULT_WORLD_GRID.defaultSpawnPoints;
    sim.spawnPawn("BuilderA", spawnA!);
    sim.spawnPawn("BuilderB", spawnB!);

    let currentMarkers = new Map<string, string>();
    for (const cell of BED_OVERFLOW_CELLS) {
      const outcome = sim.commitPlayerSelection({
        toolId: "build",
        selectionModifier: "replace",
        cellKeys: new Set([coordKey(cell)]),
        inputShape: "single-cell",
        currentMarkers,
        nowMs: 0
      });

      expect(outcome.didSubmitToWorld).toBe(true);
      expect(outcome.command?.verb).toBe("place_furniture:bed");
      expect(outcome.submitResult?.accepted).toBe(true);
      currentMarkers = outcome.nextMarkers;
    }

    const worldAfterSubmit = sim.getWorldPort().getWorld();
    expect(
      [...worldAfterSubmit.entities.values()].filter(
        (entity) => entity.kind === "blueprint" && entity.blueprintKind === "bed"
      )
    ).toHaveLength(BED_OVERFLOW_CELLS.length);
    expect(
      [...worldAfterSubmit.workItems.values()].filter((item) => item.kind === "construct-blueprint")
    ).toHaveLength(BED_OVERFLOW_CELLS.length);

    const completed = sim.runUntil(() => {
      const world = sim.getWorldPort().getWorld();
      const builtBeds = [...world.entities.values()].filter(
        (entity) => entity.kind === "building" && entity.buildingKind === "bed"
      );
      const pendingConstructs = [...world.workItems.values()].filter(
        (item) => item.kind === "construct-blueprint" && item.status !== "completed"
      );
      return builtBeds.length === BED_OVERFLOW_CELLS.length && pendingConstructs.length === 0;
    }, { maxTicks: 40_000, deltaMs: 16 });

    expect(completed.reachedPredicate).toBe(true);

    const world = sim.getWorldPort().getWorld();
    const builtBeds = [...world.entities.values()].filter(
      (entity) => entity.kind === "building" && entity.buildingKind === "bed"
    );
    expect(builtBeds).toHaveLength(BED_OVERFLOW_CELLS.length);
    expect(
      BED_OVERFLOW_CELLS.every((cell) =>
        builtBeds.some((bed) => bed.cell.col === cell.col && bed.cell.row === cell.row)
      )
    ).toBe(true);

    const assignedOwnerIds = world.restSpots
      .map((spot) => spot.ownerPawnId)
      .filter((ownerPawnId): ownerPawnId is string => ownerPawnId !== undefined);
    const unassignedSpots = world.restSpots.filter((spot) => spot.ownerPawnId === undefined);
    const unassignedBeds = builtBeds.filter((bed) => bed.ownership?.ownerPawnId === undefined);

    expect(world.restSpots).toHaveLength(BED_OVERFLOW_CELLS.length);
    expect(new Set(assignedOwnerIds).size).toBe(2);
    expect(unassignedSpots).toHaveLength(1);
    expect(unassignedBeds).toHaveLength(1);

    const pawnIds = new Set(sim.getPawns().map((pawn) => pawn.id));
    expect(assignedOwnerIds.every((ownerPawnId) => pawnIds.has(ownerPawnId))).toBe(true);

    const unassignedBed = unassignedBeds[0]!;
    const matchingRestSpot = world.restSpots.find((spot) => spot.buildingEntityId === unassignedBed.id);
    expect(matchingRestSpot?.ownerPawnId).toBeUndefined();
  });
});
