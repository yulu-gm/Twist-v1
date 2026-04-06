/**
 * refactor-test：MAP-003 场景级主验收入口；几何占用回归见 `tests/domain/occupancy-manager.test.ts`。
 */
import { describe, expect, it } from "vitest";
import { coordKey } from "../../src/game/map";
import { assertVisibleFailureFeedback, runScenarioHeadless } from "../../src/headless";
import {
  MAP_BLOCKED_PLACEMENT_BLOCKED_CELL,
  MAP_BLOCKED_PLACEMENT_FREE_CELL,
  MAP_BLOCKED_PLACEMENT_SCENARIO
} from "../../scenarios/map-blocked-placement.scenario";

describe("MAP-003 blocked placement", () => {
  it("rejects a blocked wall stroke and leaves neither blueprint nor construct work behind", () => {
    const { sim, hydration, results } = runScenarioHeadless(MAP_BLOCKED_PLACEMENT_SCENARIO);

    expect(results.every((result) => result.passed)).toBe(true);
    expect(hydration.playerSelections).toHaveLength(1);

    const selection = hydration.playerSelections[0]!;
    expect(selection.inputShape).toBe("brush-stroke");
    expect(selection.didSubmitToWorld).toBe(true);
    expect(selection.accepted).toBe(false);
    expect(selection.cellKeys).toEqual([
      coordKey(MAP_BLOCKED_PLACEMENT_BLOCKED_CELL),
      coordKey(MAP_BLOCKED_PLACEMENT_FREE_CELL)
    ]);
    expect(selection.conflictCellKeys).toEqual([coordKey(MAP_BLOCKED_PLACEMENT_BLOCKED_CELL)]);
    expect(
      assertVisibleFailureFeedback(
        sim,
        { source: "submit-result", accepted: false },
        { playerSelections: hydration.playerSelections }
      ).passed
    ).toBe(true);

    const world = sim.getWorldPort().getWorld();
    expect([...world.entities.values()].filter((entity) => entity.kind === "obstacle")).toHaveLength(1);
    expect([...world.entities.values()].some((entity) => entity.kind === "blueprint")).toBe(false);
    expect(
      [...world.workItems.values()].some((item) => item.kind === "construct-blueprint")
    ).toBe(false);
    expect(world.occupancy.get(coordKey(MAP_BLOCKED_PLACEMENT_BLOCKED_CELL))).toBeDefined();
  });
});
