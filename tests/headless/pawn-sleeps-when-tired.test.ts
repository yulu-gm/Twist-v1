// 覆盖困倦小人 headless 场景：期望当前目标为 sleep。
import { describe, expect, it } from "vitest";
import { PAWN_SLEEPS_WHEN_TIRED_SCENARIO } from "../../scenarios/pawn-sleeps-when-tired.scenario";
import { runScenarioHeadless } from "../../src/headless";

describe("pawn-sleeps-when-tired scenario", () => {
  it("passes all expectations", () => {
    const { results } = runScenarioHeadless(PAWN_SLEEPS_WHEN_TIRED_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});
