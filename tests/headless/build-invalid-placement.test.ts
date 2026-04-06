/**
 * refactor-test：BUILD-003 场景级主验收入口；placeBlueprint 规则级回归仍可由 domain/build 测试守门，不可替代本场景。
 */
import { describe, expect, it } from "vitest";
import { coordKey } from "../../src/game/map";
import { assertVisibleFailureFeedback, runScenarioHeadless } from "../../src/headless";
import {
  BUILD_INVALID_PLACEMENT_CELL,
  BUILD_INVALID_PLACEMENT_SCENARIO
} from "../../scenarios/build-invalid-placement.scenario";

describe("BUILD-003 invalid build placement", () => {
  it("rejects the placement, creates no blueprint or construct work, and reports visible failure feedback", () => {
    const { sim, hydration, results } = runScenarioHeadless(BUILD_INVALID_PLACEMENT_SCENARIO);

    expect(results.every((result) => result.passed)).toBe(true);
    expect(hydration.playerSelections).toHaveLength(1);

    const selection = hydration.playerSelections[0]!;
    expect(selection.toolId).toBe("build");
    expect(selection.inputShape).toBe("single-cell");
    expect(selection.commandVerb).toBe("place_furniture:bed");
    expect(selection.didSubmitToWorld).toBe(true);
    expect(selection.accepted).toBe(false);
    expect(selection.conflictCellKeys).toEqual([coordKey(BUILD_INVALID_PLACEMENT_CELL)]);
    expect(selection.resultSummaryLine).toBeTruthy();
    expect(
      assertVisibleFailureFeedback(
        sim,
        { source: "submit-result", accepted: false },
        { playerSelections: hydration.playerSelections }
      ).passed
    ).toBe(true);

    const world = sim.getWorldPort().getWorld();
    expect(
      [...world.entities.values()].some((entity) => entity.kind === "blueprint")
    ).toBe(false);
    expect(
      [...world.entities.values()].some(
        (entity) => entity.kind === "building" && entity.buildingKind === "bed"
      )
    ).toBe(false);
    expect(
      [...world.workItems.values()].some((item) => item.kind === "construct-blueprint")
    ).toBe(false);
    expect(world.occupancy.get(coordKey(BUILD_INVALID_PLACEMENT_CELL))).toBeDefined();
  });
});
