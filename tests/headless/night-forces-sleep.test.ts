/**
 * refactor-test：保留回归（createHeadlessSim + hydrate），不作为 TIME-001 / NEED-002 的唯一主证据。
 * 主证据：`night-forces-sleep.scenario.ts` 的 expectations + `scenario-runner.test.ts` 全量冒烟；
 * 夜间 HUD/时段可见性邻近断言仍由本文件守门。
 */
import { describe, expect, it } from "vitest";
import { NIGHT_FORCES_SLEEP_SCENARIO } from "../../scenarios/night-forces-sleep.scenario";
import {
  assertVisibleHudTime,
  captureVisibleState,
  createHeadlessSim,
  hydrateScenario
} from "../../src/headless";

const TIME_001_SCENARIO = {
  ...NIGHT_FORCES_SLEEP_SCENARIO,
  timeConfig: {
    startMinuteOfDay: 17 * 60 + 59.4
  }
} as const;

describe("TIME-001 night-forces-sleep", () => {
  it("crosses into night before the pawn is forced onto the sleep path", () => {
    const sim = createHeadlessSim({
      seed: TIME_001_SCENARIO.seed,
      worldGrid: TIME_001_SCENARIO.gridConfig
    });
    hydrateScenario(sim, TIME_001_SCENARIO);

    const beforeHud = captureVisibleState(sim).hud;
    expect(assertVisibleHudTime(sim, { dayNumber: 1, period: "day", timeLabel: "Day 1 17:59" }).passed).toBe(true);
    expect(sim.getSimEventCollector().getEventsByKind("night-start")).toHaveLength(0);

    const crossedNight = sim.runUntil(
      () => sim.getSimEventCollector().getEventsByKind("night-start").length > 0,
      { deltaMs: 1_000, maxTicks: 10 }
    );
    expect(crossedNight.reachedPredicate).toBe(true);

    const nightEvents = sim.getSimEventCollector().getEventsByKind("night-start");
    const afterHud = captureVisibleState(sim).hud;
    expect(nightEvents).toHaveLength(1);
    expect(nightEvents[0]!.dayNumber).toBe(1);
    expect(nightEvents[0]!.minuteOfDay).toBeGreaterThanOrEqual(18 * 60);
    expect(afterHud.dayNumber).toBe(1);
    expect(afterHud.minuteOfDay).toBeGreaterThanOrEqual(18 * 60);
    expect(afterHud.minuteOfDay).toBeGreaterThan(beforeHud.minuteOfDay);
    expect(afterHud.period).toBe("night");
    expect(afterHud.timeLabel).toBe("Day 1 18:00");

    const sleepReached = sim.runUntil(() => sim.getPawns()[0]?.currentGoal?.kind === "sleep", {
      deltaMs: 16,
      maxTicks: 3_000
    });
    expect(sleepReached.reachedPredicate).toBe(true);
    expect(sim.getPawns()[0]!.currentGoal?.kind).toBe("sleep");
  });
});
