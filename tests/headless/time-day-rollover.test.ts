/**
 * refactor-test：TIME-002 场景级主验收入口；纯函数时间域见 `tests/domain/time-of-day.test.ts`（仅底层回归）。
 */
import { describe, expect, it } from "vitest";
import { TIME_DAY_ROLLOVER_SCENARIO } from "../../scenarios/time-day-rollover.scenario";
import {
  assertVisibleHudTime,
  captureVisibleState,
  createHeadlessSim,
  hydrateScenario
} from "../../src/headless";

describe("TIME-002 time-day-rollover", () => {
  it("normalizes to the next day and later emits the next day-start event", () => {
    const sim = createHeadlessSim({
      seed: TIME_DAY_ROLLOVER_SCENARIO.seed,
      worldGrid: TIME_DAY_ROLLOVER_SCENARIO.gridConfig
    });
    hydrateScenario(sim, TIME_DAY_ROLLOVER_SCENARIO);

    const beforeHud = captureVisibleState(sim).hud;
    expect(assertVisibleHudTime(sim, { dayNumber: 1, period: "night", timeLabel: "Day 1 23:59" }).passed).toBe(true);

    sim.tick(500);

    const rolloverHud = captureVisibleState(sim).hud;
    expect(rolloverHud.dayNumber).toBe(2);
    expect(rolloverHud.minuteOfDay).toBeGreaterThanOrEqual(0);
    expect(rolloverHud.minuteOfDay).toBeLessThan(2);
    expect(rolloverHud.minuteOfDay).toBeLessThan(beforeHud.minuteOfDay);
    expect(rolloverHud.period).toBe("night");
    expect(rolloverHud.timeLabel).toBe("Day 2 00:00");

    const reachedDayStart = sim.runUntil(
      () => sim.getSimEventCollector().getEventsByKind("day-start").some((event) => event.dayNumber === 2),
      { deltaMs: 1_000, maxTicks: 400 }
    );
    expect(reachedDayStart.reachedPredicate).toBe(true);

    const dayStartEvent = sim
      .getSimEventCollector()
      .getEventsByKind("day-start")
      .find((event) => event.dayNumber === 2);
    const dayHud = captureVisibleState(sim).hud;
    expect(dayStartEvent).toBeDefined();
    expect(dayStartEvent!.minuteOfDay).toBeGreaterThanOrEqual(6 * 60);
    expect(dayHud.dayNumber).toBe(2);
    expect(dayHud.minuteOfDay).toBeGreaterThanOrEqual(6 * 60);
    expect(dayHud.minuteOfDay).toBeLessThan(6 * 60 + 2);
    expect(dayHud.period).toBe("day");
    expect(dayHud.timeLabel).toBe("Day 2 06:00");
  });
});
