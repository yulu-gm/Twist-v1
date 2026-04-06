/**
 * refactor-test：时间纯函数域回归；TIME-002 主证据以 `tests/headless/time-day-rollover.test.ts` 与
 * `time-day-rollover.scenario.ts` 为准，本文件不承担跨天场景语义主验收。
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIME_OF_DAY_CONFIG,
  DEFAULT_TIME_CONTROL_STATE,
  MAX_FRAME_DT_SEC,
  advanceTimeOfDay,
  createInitialTimeOfDayState,
  effectiveSimulationDeltaSeconds,
  formatTimeOfDayLabel,
  sampleTimeOfDayPalette
} from "../../src/game/time";

describe("time-of-day", () => {
  it("starts at day 1 06:00 and formats zero-padded time labels", () => {
    const state = createInitialTimeOfDayState(DEFAULT_TIME_OF_DAY_CONFIG);

    expect(state).toEqual({
      dayNumber: 1,
      minuteOfDay: 360
    });
    expect(formatTimeOfDayLabel(state)).toBe("Day 1 06:00");
  });

  it("advances time based on the configured real seconds per day", () => {
    const initial = createInitialTimeOfDayState(DEFAULT_TIME_OF_DAY_CONFIG);
    const advanced = advanceTimeOfDay(initial, 75, DEFAULT_TIME_OF_DAY_CONFIG);

    expect(advanced.dayNumber).toBe(1);
    expect(advanced.minuteOfDay).toBe(540);
    expect(formatTimeOfDayLabel(advanced)).toBe("Day 1 09:00");
  });

  it("rolls over into the next day when crossing midnight", () => {
    const state = {
      dayNumber: 1,
      minuteOfDay: 1380
    };

    const advanced = advanceTimeOfDay(state, 30, DEFAULT_TIME_OF_DAY_CONFIG);

    expect(advanced).toEqual({
      dayNumber: 2,
      minuteOfDay: 12
    });
    expect(formatTimeOfDayLabel(advanced)).toBe("Day 2 00:12");
  });

  it("supports large deltas without losing whole days", () => {
    const initial = createInitialTimeOfDayState(DEFAULT_TIME_OF_DAY_CONFIG);
    const advanced = advanceTimeOfDay(initial, 1_575, DEFAULT_TIME_OF_DAY_CONFIG);

    expect(advanced).toEqual({
      dayNumber: 3,
      minuteOfDay: 1260
    });
    expect(formatTimeOfDayLabel(advanced)).toBe("Day 3 21:00");
  });

  it("returns a zero effective delta when time is paused", () => {
    expect(
      effectiveSimulationDeltaSeconds(1.25, {
        paused: true,
        speed: 3
      })
    ).toBe(0);
  });

  it("multiplies effective delta by the selected speed (clamped to MAX_FRAME_DT_SEC)", () => {
    expect(effectiveSimulationDeltaSeconds(2, DEFAULT_TIME_CONTROL_STATE)).toBe(MAX_FRAME_DT_SEC);
    expect(
      effectiveSimulationDeltaSeconds(2, {
        paused: false,
        speed: 2
      })
    ).toBe(MAX_FRAME_DT_SEC * 2);
    expect(
      effectiveSimulationDeltaSeconds(2, {
        paused: false,
        speed: 3
      })
    ).toBe(MAX_FRAME_DT_SEC * 3);
  });

  it("does not clamp deltas at or below MAX_FRAME_DT_SEC before speed", () => {
    expect(effectiveSimulationDeltaSeconds(0.25, DEFAULT_TIME_CONTROL_STATE)).toBe(0.25);
    expect(
      effectiveSimulationDeltaSeconds(MAX_FRAME_DT_SEC, {
        paused: false,
        speed: 2
      })
    ).toBe(MAX_FRAME_DT_SEC * 2);
  });

  it("returns keyed palette colors for anchor times and interpolates between them", () => {
    const dawn = sampleTimeOfDayPalette({ dayNumber: 1, minuteOfDay: 360 });
    const noon = sampleTimeOfDayPalette({ dayNumber: 1, minuteOfDay: 720 });
    const dusk = sampleTimeOfDayPalette({ dayNumber: 1, minuteOfDay: 1080 });
    const midnight = sampleTimeOfDayPalette({ dayNumber: 2, minuteOfDay: 0 });
    const morningBlend = sampleTimeOfDayPalette({ dayNumber: 1, minuteOfDay: 540 });

    expect(dawn.backgroundColor).toBe(0x7a6f61);
    expect(noon.backgroundColor).toBe(0xd8c7a3);
    expect(dusk.backgroundColor).toBe(0x6f5f57);
    expect(midnight.backgroundColor).toBe(0x171411);
    expect(morningBlend.backgroundColor).toBe(0xa99b82);
    expect(morningBlend.gridLineColor).toBe(0x63594b);
    expect(morningBlend.primaryTextColor).toBe(0xf5ebd4);
    expect(morningBlend.secondaryTextColor).toBe(0xd5c5ad);
  });

  it("keeps the overnight palette transition continuous across midnight", () => {
    const beforeMidnight = sampleTimeOfDayPalette({ dayNumber: 1, minuteOfDay: 1439 });
    const afterMidnight = sampleTimeOfDayPalette({ dayNumber: 2, minuteOfDay: 1 });

    expect(Math.abs(beforeMidnight.backgroundColor - afterMidnight.backgroundColor)).toBeLessThan(
      0x010101
    );
    expect(Math.abs(beforeMidnight.gridLineColor - afterMidnight.gridLineColor)).toBeLessThan(
      0x010101
    );
  });
});
