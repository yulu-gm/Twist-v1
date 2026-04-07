/**
 * refactor-test：保留回归（createHeadlessSim + hydrate 直连），不承担 NEED-001 主验收唯一证据。
 * 主证据：`scenarios/pawn-eats-when-hungry.scenario.ts` 的 expectations 由 `tests/headless/scenario-runner.test.ts`
 * 对 ALL_SCENARIOS 统一跑通；本文件补充饥饿→进食链路的细粒度断言。
 */
import { describe, expect, it } from "vitest";
import { pawnNeedsFromScalars } from "../../src/game/need/need-utils";
import { createHeadlessSim, hydrateScenario } from "../../src/headless";
import { PAWN_EATS_WHEN_HUNGRY_SCENARIO } from "../../scenarios/pawn-eats-when-hungry.scenario";

describe("NEED-001 pawn-eats-when-hungry", () => {
  it("naturally switches to eat, reaches food-1, and restores satiety after using the food point", () => {
    const sim = createHeadlessSim({
      seed: PAWN_EATS_WHEN_HUNGRY_SCENARIO.seed,
      worldGrid: PAWN_EATS_WHEN_HUNGRY_SCENARIO.gridConfig
    });
    hydrateScenario(sim, PAWN_EATS_WHEN_HUNGRY_SCENARIO);

    const initialPawn = sim.getPawns()[0]!;
    expect(initialPawn.currentGoal).toBeUndefined();
    /** 与 {@link normalizePawnNeedSnapshot} 一致：饥饿紧迫度由饱食标量推导，而非场景里手写 needs 覆盖。 */
    expect(initialPawn.needs.hunger).toBe(pawnNeedsFromScalars(5, 100, 6).hunger);

    const reachedEatGoal = sim.runUntil(() => {
      const pawn = sim.getPawns()[0];
      return pawn?.currentGoal?.kind === "eat";
    }, { maxTicks: 200 });
    expect(reachedEatGoal.reachedPredicate).toBe(true);

    const goalPawn = sim.getPawns()[0]!;
    expect(goalPawn.currentGoal).toMatchObject({
      kind: "eat",
      targetId: "food-1"
    });
    expect(goalPawn.currentAction?.kind === "move-to-target" || goalPawn.currentAction?.kind === "use-target").toBe(true);

    const startedUsingFood = sim.runUntil(() => {
      const pawn = sim.getPawns()[0];
      return pawn?.currentAction?.kind === "use-target" && pawn.currentAction.targetId === "food-1";
    }, { maxTicks: 2_000 });
    expect(startedUsingFood.reachedPredicate).toBe(true);

    const completedEating = sim.runUntil(() => {
      const pawn = sim.getPawns()[0];
      return Boolean(
        pawn &&
          pawn.needs.hunger < initialPawn.needs.hunger
      );
    }, { maxTicks: 2_000 });
    expect(completedEating.reachedPredicate).toBe(true);

    const finalPawn = sim.getPawns()[0]!;
    expect(finalPawn.needs.hunger).toBeLessThan(initialPawn.needs.hunger);

    const goalEvents = sim.getSimEventCollector().getEventsByKind("pawn-goal-changed");
    const actionEvents = sim.getSimEventCollector().getEventsByKind("pawn-action-changed");
    expect(
      goalEvents.some(
        (event) => event.pawnId === "pawn-0" && event.after?.kind === "eat" && event.after.targetId === "food-1"
      )
    ).toBe(true);
    expect(
      actionEvents.some(
        (event) =>
          event.pawnId === "pawn-0" &&
          event.after?.kind === "use-target" &&
          event.after.targetId === "food-1"
      )
    ).toBe(true);
    const needEvents = sim.getSimEventCollector().getEventsByKind("pawn-need-changed");
    expect(
      needEvents.some(
        (event) =>
          event.pawnId === "pawn-0" &&
          event.before.needs.hunger > event.after.needs.hunger &&
          event.after.needs.hunger < initialPawn.needs.hunger
      )
    ).toBe(true);
  });
});
