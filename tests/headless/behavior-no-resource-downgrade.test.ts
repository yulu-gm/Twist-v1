/**
 * refactor-test：BEHAVIOR-004 场景级主验收入口（无资源降级路径）。
 */
import { describe, expect, it } from "vitest";
import {
  captureVisibleState,
  createHeadlessSim,
  hydrateScenario
} from "../../src/headless";
import { BEHAVIOR_004_NO_RESOURCE_DOWNGRADE_SCENARIO } from "../../scenarios/behavior-004-no-resource-downgrade.scenario";

describe("BEHAVIOR-004 behavior-no-resource-downgrade", () => {
  it("does not fabricate a sleep target and falls back to visible wander movement when no bed exists", () => {
    const sim = createHeadlessSim({
      seed: BEHAVIOR_004_NO_RESOURCE_DOWNGRADE_SCENARIO.seed,
      worldGrid: BEHAVIOR_004_NO_RESOURCE_DOWNGRADE_SCENARIO.gridConfig
    });
    hydrateScenario(sim, BEHAVIOR_004_NO_RESOURCE_DOWNGRADE_SCENARIO);

    const collector = sim.getSimEventCollector();

    const downgradedToWander = sim.runUntil(
      () => sim.getPawns()[0]?.currentGoal?.kind === "wander",
      { maxTicks: 200, deltaMs: 16 }
    );
    expect(downgradedToWander.reachedPredicate).toBe(true);

    const wanderGoalEvent = collector
      .getEventsByKind("pawn-goal-changed")
      .find((event) => event.pawnId === "pawn-0" && event.after?.kind === "wander");
    expect(wanderGoalEvent).toBeDefined();
    expect(wanderGoalEvent?.after?.reason).toBe("fallback-wander");
    expect(
      collector.getEventsByKind("pawn-goal-changed").some((event) => event.after?.kind === "sleep")
    ).toBe(false);

    collector.clear();

    const movedAfterDowngrade = sim.runUntil(
      () => collector.getEventsByKind("pawn-moved").some((event) => event.pawnId === "pawn-0"),
      { maxTicks: 500, deltaMs: 16 }
    );
    expect(movedAfterDowngrade.reachedPredicate).toBe(true);

    const finalPawn = sim.getPawns()[0]!;
    const moveEvent = collector
      .getEventsByKind("pawn-moved")
      .find((event) => event.pawnId === "pawn-0");

    expect(finalPawn.currentGoal).toMatchObject({
      kind: "wander",
      reason: "fallback-wander"
    });
    expect(finalPawn.currentGoal?.targetId).toBeUndefined();
    expect(finalPawn.currentAction?.kind).not.toBe("use-target");
    expect(finalPawn.currentAction?.targetId?.startsWith("bed-")).not.toBe(true);
    expect(captureVisibleState(sim).workItems).toEqual([]);
    expect(moveEvent?.after).toEqual(finalPawn.logicalCell);
    expect(moveEvent?.after).not.toEqual(moveEvent?.before);
  });
});
