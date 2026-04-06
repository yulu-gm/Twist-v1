import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_GRID } from "../../src/game/map";
import { createHeadlessSim } from "../../src/headless";
import { runScenarioHeadless } from "../../src/headless/scenario-runner";
import { placeBlueprint } from "../../src/game/world-core";
import {
  BED_AUTO_ASSIGN_SCENARIO,
  BED_BLUEPRINT_CELL
} from "../../scenarios/bed-auto-assign.scenario";

describe("bed-auto-assign scenario", () => {
  it("building-present 通过且床 restSpot 已写入 owner", () => {
    const { results, sim } = runScenarioHeadless(BED_AUTO_ASSIGN_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);

    const world = sim.getWorldPort().getWorld();
    const bedEntity = [...world.entities.values()].find(
      (e) =>
        e.kind === "building" &&
        e.buildingKind === "bed" &&
        e.cell.col === BED_BLUEPRINT_CELL.col &&
        e.cell.row === BED_BLUEPRINT_CELL.row
    );
    expect(bedEntity).toBeDefined();
    const spot = world.restSpots.find((s) => s.buildingEntityId === bedEntity!.id);
    expect(spot).toBeDefined();
    expect(spot!.ownerPawnId).toBeDefined();
  });

  it("BUILD-004：全员有床时新落成的床 ownerPawnId 仍为 undefined", () => {
    const sim = createHeadlessSim({ seed: 0x42_34_30_30_34 });
    const port = sim.getWorldPort();
    const [c0, c1] = DEFAULT_WORLD_GRID.defaultSpawnPoints;
    sim.spawnPawn("A", c0!);
    sim.spawnPawn("B", c1!);

    const bedCells = [
      { col: 11, row: 5 },
      { col: 11, row: 6 },
      { col: 11, row: 7 }
    ] as const;

    for (const cell of bedCells) {
      let w = port.getWorld();
      const placed = placeBlueprint(w, { buildingKind: "bed", cell });
      port.setWorld(placed.world);
    }

    const done = (): boolean => {
      const w = port.getWorld();
      const bedN = [...w.entities.values()].filter(
        (e) => e.kind === "building" && e.buildingKind === "bed"
      ).length;
      if (bedN < 3) return false;
      const pending = [...w.workItems.values()].some(
        (x) => x.kind === "construct-blueprint" && x.status !== "completed"
      );
      return !pending;
    };

    const run = sim.runUntil(done, { maxTicks: 25_000, deltaMs: 16 });
    expect(run.reachedPredicate).toBe(true);

    const world = port.getWorld();
    expect(world.restSpots).toHaveLength(3);
    const unassigned = world.restSpots.filter((s) => s.ownerPawnId === undefined);
    expect(unassigned).toHaveLength(1);
    expect(world.restSpots.filter((s) => s.ownerPawnId !== undefined)).toHaveLength(2);
  });
});
