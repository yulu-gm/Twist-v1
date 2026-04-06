/**
 * refactor-test：BEHAVIOR-001 场景级主验收入口之一（`behavior-001-wander.scenario.ts` + createHeadlessSim 推进）。
 */
import { describe, expect, it } from "vitest";
import {
  captureVisibleState,
  createHeadlessSim,
  hydrateScenario
} from "../../src/headless";
import { BEHAVIOR_001_WANDER_SCENARIO } from "../../scenarios/behavior-001-wander.scenario";

describe("BEHAVIOR-001 behavior-wander", () => {
  it("lets an idle pawn naturally switch into wander and visibly move in the scene", () => {
    const sim = createHeadlessSim({
      seed: BEHAVIOR_001_WANDER_SCENARIO.seed,
      worldGrid: BEHAVIOR_001_WANDER_SCENARIO.gridConfig
    });
    hydrateScenario(sim, BEHAVIOR_001_WANDER_SCENARIO);

    const collector = sim.getSimEventCollector();

    expect(sim.getPawns()).toHaveLength(1);
    expect(sim.getPawns()[0]!.currentGoal).toBeUndefined();
    expect(captureVisibleState(sim).workItems).toEqual([]);

    const reachedWander = sim.runUntil(() => sim.getPawns()[0]?.currentGoal?.kind === "wander", {
      maxTicks: 200,
      deltaMs: 16
    });
    expect(reachedWander.reachedPredicate).toBe(true);

    const wanderGoalEvent = collector
      .getEventsByKind("pawn-goal-changed")
      .find((event) => event.pawnId === "pawn-0" && event.after?.kind === "wander");
    expect(wanderGoalEvent).toBeDefined();
    expect(wanderGoalEvent?.after?.reason).toBe("fallback-wander");

    const pawnBeforeMove = sim.getPawns()[0]!;
    collector.clear();

    const movedWhileWandering = sim.runUntil(
      () => collector.getEventsByKind("pawn-moved").some((event) => event.pawnId === "pawn-0"),
      { maxTicks: 500, deltaMs: 16 }
    );
    expect(movedWhileWandering.reachedPredicate).toBe(true);

    const moveEvent = collector
      .getEventsByKind("pawn-moved")
      .find((event) => event.pawnId === "pawn-0");
    const finalPawn = sim.getPawns()[0]!;

    expect(finalPawn.currentGoal).toMatchObject({ kind: "wander" });
    expect(moveEvent?.before).toEqual(pawnBeforeMove.logicalCell);
    expect(moveEvent?.after).not.toEqual(moveEvent?.before);
    expect(moveEvent?.after).toEqual(finalPawn.logicalCell);
  });
});
