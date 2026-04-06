/**
 * refactor-test：INTERACT-004 场景级主验收入口（无工具输入语义与世界无副作用）。
 */
import { describe, expect, it } from "vitest";
import { getWorldSnapshot } from "../../src/game/world-core";
import {
  assertPlayerInputSemantic,
  captureVisibleState,
  createHeadlessSim,
  runScenarioHeadless
} from "../../src/headless";
import { hydrateScenario } from "../../src/headless/scenario-runner";
import { INTERACTION_NO_TOOL_SCENARIO } from "../../scenarios/interaction-no-tool.scenario";

describe("INTERACT-004 no-tool input", () => {
  it("keeps no-tool click and drag inputs inert with no selection, blueprint, work item, or world side effect", () => {
    const baselineSim = createHeadlessSim({ seed: INTERACTION_NO_TOOL_SCENARIO.seed });
    hydrateScenario(baselineSim, {
      ...INTERACTION_NO_TOOL_SCENARIO,
      playerSelectionAfterHydrate: undefined,
      expectations: undefined
    });
    const baselineSnapshot = getWorldSnapshot(baselineSim.getWorldPort().getWorld());

    const { hydration, results, sim } = runScenarioHeadless({
      ...INTERACTION_NO_TOOL_SCENARIO,
      expectations: undefined
    });
    const world = sim.getWorldPort().getWorld();
    const visible = captureVisibleState(sim, { playerSelections: hydration.playerSelections });

    expect(results).toEqual([]);
    expect(hydration.playerSelections).toHaveLength(2);
    expect(assertPlayerInputSemantic(hydration.playerSelections[0]!, "no-tool").passed).toBe(true);
    expect(assertPlayerInputSemantic(hydration.playerSelections[1]!, "no-tool").passed).toBe(true);
    expect(
      hydration.playerSelections.every(
        (selection) =>
          selection.didSubmitToWorld === false &&
          selection.accepted === null &&
          selection.commandVerb === null
      )
    ).toBe(true);

    expect(world.markers.size).toBe(0);
    expect([...world.entities.values()].filter((entity) => entity.kind === "blueprint")).toHaveLength(0);
    expect([...world.workItems.values()]).toHaveLength(0);
    expect(visible.workItems).toHaveLength(0);
    expect(visible.failures).toHaveLength(0);
    expect(getWorldSnapshot(world)).toEqual(baselineSnapshot);
  });
});
