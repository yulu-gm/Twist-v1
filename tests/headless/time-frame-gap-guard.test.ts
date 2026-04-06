/**
 * refactor-test：TIME-004 场景级主验收入口；极端帧间隔守门另见 `headless-sim-basic.test.ts`（底层回归）。
 */
import { describe, expect, it } from "vitest";
import { TIME_FRAME_GAP_GUARD_SCENARIO } from "../../scenarios/time-frame-gap-guard.scenario";
import { DEFAULT_TIME_OF_DAY_CONFIG, MAX_FRAME_DT_SEC } from "../../src/game/time";
import {
  assertVisibleHudTime,
  captureVisibleState,
  createHeadlessSim,
  hydrateScenario
} from "../../src/headless";

function totalWorldMinutes(worldTime: { dayNumber: number; minuteOfDay: number }): number {
  return (worldTime.dayNumber - 1) * 24 * 60 + worldTime.minuteOfDay;
}

describe("TIME-004 time-frame-gap-guard", () => {
  it("caps a single oversized frame gap to MAX_FRAME_DT_SEC-equivalent progress", () => {
    const sim = createHeadlessSim({
      seed: TIME_FRAME_GAP_GUARD_SCENARIO.seed,
      worldGrid: TIME_FRAME_GAP_GUARD_SCENARIO.gridConfig
    });
    hydrateScenario(sim, TIME_FRAME_GAP_GUARD_SCENARIO);

    const before = sim.getWorldTime();
    const beforeHud = captureVisibleState(sim).hud;
    expect(assertVisibleHudTime(sim, { dayNumber: 1, period: "day", speed: 3, timeLabel: "Day 1 12:00" }).passed).toBe(true);

    sim.tick(10_000);

    const after = sim.getWorldTime();
    const afterHud = captureVisibleState(sim).hud;
    const minutesPerSimSecond = (24 * 60) / DEFAULT_TIME_OF_DAY_CONFIG.realSecondsPerDay;
    const maxMinuteAdvance =
      MAX_FRAME_DT_SEC * (TIME_FRAME_GAP_GUARD_SCENARIO.timeConfig?.speed ?? before.speed) * minutesPerSimSecond;
    const actualAdvance = totalWorldMinutes(after) - totalWorldMinutes(before);

    expect(actualAdvance).toBeGreaterThan(0);
    expect(actualAdvance).toBeLessThanOrEqual(maxMinuteAdvance + 1e-9);
    expect(after.dayNumber).toBe(before.dayNumber);
    expect(after.currentPeriod).toBe(before.currentPeriod);
    expect(afterHud.minuteOfDay).toBe(after.minuteOfDay);
    expect(afterHud.minuteOfDay - beforeHud.minuteOfDay).toBeLessThan(5);
    expect(afterHud.timeLabel).toBe("Day 1 12:03");
    expect(sim.getSimEventCollector().getEventsByKind("day-start")).toHaveLength(0);
    expect(sim.getSimEventCollector().getEventsByKind("night-start")).toHaveLength(0);
  });
});
