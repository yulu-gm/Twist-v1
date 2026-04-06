// 三人殖民地：不饿死且模拟中出现 pawn-goal-changed 事件。
/**
 * refactor-test：保留回归（多小人殖民地 smoke），BEHAVIOR-002 / UI-003 主证据以场景 expectations
 * + `scenario-runner.test.ts` 及 `ui-pawn-panel-sync.test.ts`（UI）为准。
 */
import { describe, expect, it } from "vitest";
import { MULTI_PAWN_COLONY_SCENARIO } from "../../scenarios/multi-pawn-colony.scenario";
import { runScenarioHeadless } from "../../src/headless";

describe("multi-pawn-colony scenario", () => {
  it("passes all expectations", () => {
    const { results } = runScenarioHeadless(MULTI_PAWN_COLONY_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});
