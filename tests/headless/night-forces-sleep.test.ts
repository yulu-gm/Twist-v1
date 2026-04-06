// 覆盖夜间强制睡眠倾向 headless 场景：期望当前目标为 sleep。
import { describe, expect, it } from "vitest";
import { NIGHT_FORCES_SLEEP_SCENARIO } from "../../scenarios/night-forces-sleep.scenario";
import { runScenarioHeadless } from "../../src/headless";

describe("night-forces-sleep scenario", () => {
  it("passes all expectations", () => {
    const { results } = runScenarioHeadless(NIGHT_FORCES_SLEEP_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});
