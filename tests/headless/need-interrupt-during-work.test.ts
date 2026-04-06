/**
 * refactor-test：保留回归（需求打断工单直连），NEED-003 / BEHAVIOR-003 主证据以场景 expectations
 * + `scenario-runner.test.ts` 为准；本文件覆盖饥饿阈值调参后的中断时序。
 */
import { describe, expect, it } from "vitest";
import {
  captureVisibleState,
  createHeadlessSim,
  hydrateScenario
} from "../../src/headless";
import type { ScenarioDefinition } from "../../src/headless/scenario-types";
import { NEED_INTERRUPT_DURING_WORK_SCENARIO } from "../../scenarios/need-interrupt-during-work.scenario";

const NATURAL_HUNGER_INTERRUPT_SCENARIO: ScenarioDefinition = {
  ...NEED_INTERRUPT_DURING_WORK_SCENARIO,
  pawns: [
    {
      name: "HungryLumber",
      cell: NEED_INTERRUPT_DURING_WORK_SCENARIO.pawns[0]!.cell,
      overrides: {
        satiety: 35,
        energy: 100,
        /**
         * 路上增长约 +8.7：须 <70 才能走到锚点并开始读条；锚点后须在 3s 读条完成前涨到 >70 触发中断。
         * 50 过低会先完工单；58 落在 (~66→70) 与 (<70 抵锚) 之间的稳定窗内。
         */
        needs: { hunger: 58, rest: 10, recreation: 20 }
      }
    }
  ],
  expectations: []
};

describe("BEHAVIOR-003 need-interrupt-during-work", () => {
  it("releases claimed work after a hunger interrupt and retargets the pawn to food", () => {
    const sim = createHeadlessSim({
      seed: NATURAL_HUNGER_INTERRUPT_SCENARIO.seed,
      worldGrid: NATURAL_HUNGER_INTERRUPT_SCENARIO.gridConfig
    });
    hydrateScenario(sim, NATURAL_HUNGER_INTERRUPT_SCENARIO);

    const claimedWork = sim.runUntil(() => {
      return captureVisibleState(sim).workItems.some(
        (item) => item.kind === "chop-tree" && item.status === "claimed" && item.claimedBy === "pawn-0"
      );
    }, { maxTicks: 400, deltaMs: 16 });
    expect(claimedWork.reachedPredicate).toBe(true);

    const claimedSnapshot = captureVisibleState(sim).workItems.find((item) => item.kind === "chop-tree");
    expect(claimedSnapshot).toMatchObject({
      kind: "chop-tree",
      status: "claimed",
      claimedBy: "pawn-0",
      failureCount: 0
    });

    const startedAnchoredWork = sim.runUntil(() => {
      const pawn = sim.getPawns()[0];
      return pawn?.activeWorkItemId === claimedSnapshot?.id && pawn.workTimerSec > 0;
    }, { maxTicks: 4_000, deltaMs: 16 });
    expect(startedAnchoredWork.reachedPredicate).toBe(true);

    const claimEvent = sim
      .getSimEventCollector()
      .getEventsByKind("work-claimed")
      .find((event) => event.workItemId === claimedSnapshot?.id && event.claimedBy === "pawn-0");
    expect(claimEvent).toBeDefined();

    sim.getSimEventCollector().clear();

    const interruptedToEat = sim.runUntil(() => {
      const pawn = sim.getPawns()[0];
      const chop = captureVisibleState(sim).workItems.find((item) => item.kind === "chop-tree");
      return Boolean(
        pawn?.currentGoal?.kind === "eat" &&
          pawn.currentGoal.targetId === "food-1" &&
          chop?.status === "open" &&
          chop.claimedBy === undefined
      );
    }, { maxTicks: 2_000, deltaMs: 16 });
    expect(interruptedToEat.reachedPredicate).toBe(true);

    const steppedTowardFood = sim.runUntil(() => {
      const c = sim.getSimEventCollector();
      return (
        c.getEventsByKind("pawn-moved").some((e) => e.pawnId === "pawn-0") ||
        c.getEventsByKind("pawn-motion-changed").some((e) => e.pawnId === "pawn-0")
      );
    }, { maxTicks: 2_500, deltaMs: 16 });
    expect(steppedTowardFood.reachedPredicate).toBe(true);

    const finalPawn = sim.getPawns()[0]!;
    const finalChop = captureVisibleState(sim).workItems.find((item) => item.kind === "chop-tree");
    const postInterruptCollector = sim.getSimEventCollector();
    const goalEvents = postInterruptCollector.getEventsByKind("pawn-goal-changed");
    const eatGoalEvent = goalEvents.find(
      (event) => event.pawnId === "pawn-0" && event.after?.kind === "eat" && event.after.targetId === "food-1"
    );

    expect(finalChop).toMatchObject({
      kind: "chop-tree",
      status: "open"
    });
    expect(finalChop?.claimedBy).toBeUndefined();
    expect(finalChop?.failureCount).toBeGreaterThanOrEqual(1);
    expect(finalPawn.activeWorkItemId).toBeUndefined();
    expect(finalPawn.workTimerSec).toBe(0);
    expect(finalPawn.currentGoal).toMatchObject({
      kind: "eat",
      targetId: "food-1"
    });
    expect(finalPawn.currentAction?.kind === "move-to-target" || finalPawn.currentAction?.kind === "use-target").toBe(
      true
    );
    expect(eatGoalEvent).toBeDefined();
    expect(eatGoalEvent!.tick).toBeGreaterThan(claimEvent!.tick);
    expect(
      postInterruptCollector.getEventsByKind("pawn-moved").some((e) => e.pawnId === "pawn-0") ||
        postInterruptCollector.getEventsByKind("pawn-motion-changed").some((e) => e.pawnId === "pawn-0")
    ).toBe(true);
  });

  it("need-interrupt 后的下一帧不会立刻把同一条 work 重新认领回来", () => {
    const scenarioFull: ScenarioDefinition = {
      ...NEED_INTERRUPT_DURING_WORK_SCENARIO,
      expectations: [],
      pawns: [
        {
          name: "HungryLumber",
          cell: NEED_INTERRUPT_DURING_WORK_SCENARIO.pawns[0]!.cell,
          overrides: {
            satiety: 100,
            energy: 100,
            needs: { hunger: 15, rest: 10, recreation: 20 }
          }
        }
      ]
    };

    const sim = createHeadlessSim({
      seed: NEED_INTERRUPT_DURING_WORK_SCENARIO.seed,
      debugTrace: {
        enabled: true,
        snapshotWorkItemsEachTick: true
      }
    });
    hydrateScenario(sim, scenarioFull);

    const claimed = sim.runUntil(() => {
      return [...sim.getWorldPort().getWorld().workItems.values()].some(
        (w) => w.kind === "chop-tree" && w.status === "claimed" && w.claimedBy === "pawn-0"
      );
    }, { maxTicks: 4000 });
    expect(claimed.reachedPredicate).toBe(true);

    const ref = sim.getSimAccess().getPawnsRef();
    const p = ref[0]!;
    ref[0] = {
      ...p,
      satiety: 5,
      needs: { hunger: 92, rest: p.needs.rest, recreation: p.needs.recreation }
    };

    sim.tick(16);
    const chopAfterInterrupt = [...sim.getWorldPort().getWorld().workItems.values()].find(
      (w) => w.kind === "chop-tree"
    );
    const failureCountAfterInterrupt = chopAfterInterrupt?.failureCount;
    expect(chopAfterInterrupt?.status).toBe("open");
    expect(chopAfterInterrupt?.claimedBy).toBeUndefined();

    sim.getSimEventCollector().clear();
    sim.tick(16);
    const chopAfterNextTick = [...sim.getWorldPort().getWorld().workItems.values()].find(
      (w) => w.kind === "chop-tree"
    );
    expect(chopAfterNextTick?.status).toBe("open");
    expect(chopAfterNextTick?.claimedBy).toBeUndefined();
    expect(chopAfterNextTick?.failureCount).toBe(failureCountAfterInterrupt);
    expect(
      sim.getSimEventCollector().getEventsByKind("work-failed").filter((e) => e.workItemId === chopAfterNextTick?.id)
    ).toHaveLength(0);
  });
});
