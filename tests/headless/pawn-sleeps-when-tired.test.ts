/**
 * refactor-test：保留回归（疲劳→睡眠链路直连），不替代 NEED-002 夜间强制睡场景的主语义。
 * 主证据：`night-forces-sleep.scenario.ts` + `scenario-runner.test.ts`；本文件覆盖昼间疲劳睡径。
 */
import { describe, expect, it } from "vitest";
import {
  captureVisibleState,
  createHeadlessSim,
  hydrateScenario
} from "../../src/headless";
import { PAWN_SLEEPS_WHEN_TIRED_SCENARIO } from "../../scenarios/pawn-sleeps-when-tired.scenario";

describe("NEED-002 pawn-sleeps-when-tired", () => {
  it("falls asleep from fatigue during daytime, reaches a bed, and restores energy", () => {
    const sim = createHeadlessSim({
      seed: PAWN_SLEEPS_WHEN_TIRED_SCENARIO.seed,
      worldGrid: PAWN_SLEEPS_WHEN_TIRED_SCENARIO.gridConfig
    });
    hydrateScenario(sim, PAWN_SLEEPS_WHEN_TIRED_SCENARIO);

    const initialPawn = sim.getPawns()[0]!;
    const initialHud = captureVisibleState(sim).hud;
    expect(initialPawn.currentGoal).toBeUndefined();
    expect(initialPawn.needs.rest).toBe(92);
    expect(initialHud.period).toBe("day");

    const reachedSleepGoal = sim.runUntil(() => {
      const pawn = sim.getPawns()[0];
      return pawn?.currentGoal?.kind === "sleep";
    }, { maxTicks: 300 });
    expect(reachedSleepGoal.reachedPredicate).toBe(true);

    const goalPawn = sim.getPawns()[0]!;
    expect(goalPawn.currentGoal?.kind).toBe("sleep");
    expect(goalPawn.currentGoal?.targetId?.startsWith("bed-")).toBe(true);

    const startedSleeping = sim.runUntil(() => {
      const pawn = sim.getPawns()[0];
      return pawn?.currentAction?.kind === "use-target" && pawn.currentAction.targetId?.startsWith("bed-");
    }, { maxTicks: 3_000 });
    expect(startedSleeping.reachedPredicate).toBe(true);

    const regainedEnergy = sim.runUntil(() => {
      const pawn = sim.getPawns()[0];
      return Boolean(
        pawn &&
          pawn.needs.rest < initialPawn.needs.rest
      );
    }, { maxTicks: 3_000 });
    expect(regainedEnergy.reachedPredicate).toBe(true);

    const finalPawn = sim.getPawns()[0]!;
    const finalHud = captureVisibleState(sim).hud;
    expect(finalHud.period).toBe("day");
    expect(finalPawn.needs.rest).toBeLessThan(initialPawn.needs.rest);

    const goalEvents = sim.getSimEventCollector().getEventsByKind("pawn-goal-changed");
    const actionEvents = sim.getSimEventCollector().getEventsByKind("pawn-action-changed");
    expect(
      goalEvents.some(
        (event) =>
          event.pawnId === "pawn-0" &&
          event.after?.kind === "sleep" &&
          event.after.targetId?.startsWith("bed-")
      )
    ).toBe(true);
    expect(
      actionEvents.some(
        (event) =>
          event.pawnId === "pawn-0" &&
          event.after?.kind === "use-target" &&
          event.after.targetId?.startsWith("bed-")
      )
    ).toBe(true);
    const needEvents = sim.getSimEventCollector().getEventsByKind("pawn-need-changed");
    expect(
      needEvents.some(
        (event) =>
          event.pawnId === "pawn-0" &&
          event.before.needs.rest > event.after.needs.rest &&
          event.after.needs.rest < initialPawn.needs.rest
      )
    ).toBe(true);
  });
});
