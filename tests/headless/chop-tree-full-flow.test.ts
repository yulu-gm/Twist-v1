import { describe, expect, it } from "vitest";
import { CHOP_TREE_FULL_FLOW_SCENARIO } from "../../scenarios/chop-tree-full-flow.scenario";
import { runScenarioHeadless } from "../../src/headless/scenario-runner";

describe("chop-tree-full-flow scenario", () => {
  it("邻树 lumber：work-claimed → work-completed，树消失且出现 wood resource", () => {
    const { results, sim } = runScenarioHeadless(CHOP_TREE_FULL_FLOW_SCENARIO);
    expect(results.every((r) => r.passed)).toBe(true);

    const entities = [...sim.getWorldPort().getWorld().entities.values()];
    expect(entities.some((e) => e.kind === "tree")).toBe(false);
    const wood = entities.filter((e) => e.kind === "resource" && e.materialKind === "wood");
    expect(wood.length).toBeGreaterThanOrEqual(1);
  });
});
