// 覆盖饥饿小人 headless 场景：runScenarioHeadless 应满足「当前目标为 eat」期望。
import { describe, expect, it } from "vitest";
import { PAWN_EATS_WHEN_HUNGRY_SCENARIO } from "../../scenarios/pawn-eats-when-hungry.scenario";
import { runScenarioHeadless } from "../../src/headless";

describe("pawn-eats-when-hungry scenario", () => {
  it("passes all expectations", () => {
    const { results } = runScenarioHeadless(PAWN_EATS_WHEN_HUNGRY_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});
