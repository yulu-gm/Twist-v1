/**
 * refactor-test：保留回归（多工人抢蓝图工单时序），WORK-004 主证据以 `build-bed-flow`/`bed-auto-assign`
 * 场景 expectations + `scenario-runner.test.ts` 为准。
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_GRID } from "../../src/game/map";
import { captureVisibleState, createHeadlessSim } from "../../src/headless";
import { hydrateScenario } from "../../src/headless/scenario-runner";
import { BUILD_BED_FLOW_SCENARIO } from "../../scenarios/build-bed-flow.scenario";

describe("WORK-004 work-blueprint-race", () => {
  it("keeps a single blueprint work item exclusively claimed by one pawn", () => {
    const sim = createHeadlessSim({ seed: BUILD_BED_FLOW_SCENARIO.seed });
    hydrateScenario(sim, {
      ...BUILD_BED_FLOW_SCENARIO,
      pawns: [
        { name: "BuilderA", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! },
        { name: "BuilderB", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[1]! }
      ],
      claimConstructBlueprintAsPawnName: undefined,
      expectations: undefined
    });

    expect(
      captureVisibleState(sim).workItems.filter(
        (item) => item.kind === "construct-blueprint" && item.status === "open"
      )
    ).toHaveLength(1);

    const collector = sim.getSimEventCollector();
    collector.clear();

    const claimed = sim.runUntil(
      () => collector.getEventsByKind("work-claimed").length > 0,
      { maxTicks: 500, deltaMs: 16 }
    );
    expect(claimed.reachedPredicate).toBe(true);

    const claimedEvents = collector.getEventsByKind("work-claimed");
    expect(claimedEvents).toHaveLength(1);

    const claimEvent = claimedEvents[0]!;
    expect(claimEvent.claimedBy).toBeDefined();

    const claimedWork = [...sim.getWorldPort().getWorld().workItems.values()].find(
      (item) => item.id === claimEvent.workItemId
    );
    expect(claimedWork?.kind).toBe("construct-blueprint");
    expect(claimedWork?.status).toBe("claimed");
    expect(claimedWork?.claimedBy).toBe(claimEvent.claimedBy);

    const activeBuilder = sim.runUntil(
      () =>
        sim.getPawns().filter((pawn) => pawn.activeWorkItemId === claimEvent.workItemId).length === 1,
      { maxTicks: 4_000, deltaMs: 16 }
    );
    expect(activeBuilder.reachedPredicate).toBe(true);

    const holders = sim.getPawns().filter(
      (pawn) => pawn.activeWorkItemId === claimEvent.workItemId
    );
    expect(holders).toHaveLength(1);
    expect(holders[0]!.id).toBe(claimEvent.claimedBy);

    const otherPawn = sim.getPawns().find((pawn) => pawn.id !== claimEvent.claimedBy);
    expect(otherPawn).toBeDefined();
    expect(
      collector.getEventsByPawn(otherPawn!.id).some((event) => event.kind === "work-claimed")
    ).toBe(false);

    const targetCell = BUILD_BED_FLOW_SCENARIO.blueprints![0]!.cell;
    const built = sim.runUntil(
      () =>
        [...sim.getWorldPort().getWorld().entities.values()].some(
          (entity) =>
            entity.kind === "building" &&
            entity.buildingKind === "bed" &&
            entity.cell.col === targetCell.col &&
            entity.cell.row === targetCell.row
        ),
      { maxTicks: 4_000, deltaMs: 16 }
    );
    expect(built.reachedPredicate).toBe(true);
    expect(collector.getEventsByKind("work-claimed")).toHaveLength(1);
  });
});
