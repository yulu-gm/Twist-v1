/**
 * refactor-test：MAP-004 场景级主验收入口；框选纯函数规则见 `tests/domain/floor-selection.test.ts`（底层回归）。
 */
import { describe, expect, it } from "vitest";
import {
  beginFloorSelection,
  commitFloorSelection,
  createFloorSelectionState,
  updateFloorSelection
} from "../../src/game/interaction/floor-selection";
import { coordKey } from "../../src/game/map";
import { createHeadlessSim } from "../../src/headless";
import { hydrateScenario } from "../../src/headless/scenario-runner";
import {
  MAP_OUT_OF_BOUNDS_SELECTION_SCENARIO,
  MAP_OUT_OF_BOUNDS_VALID_RESOURCE_CELLS
} from "../../scenarios/map-out-of-bounds-selection.scenario";

function sortedKeys(keys: Iterable<string>): string[] {
  return [...keys].sort();
}

describe("MAP-004 out-of-bounds selection", () => {
  it("clips the final selection to in-bounds cells before submitting haul targets", () => {
    const sim = createHeadlessSim({
      seed: MAP_OUT_OF_BOUNDS_SELECTION_SCENARIO.seed,
      worldGrid: MAP_OUT_OF_BOUNDS_SELECTION_SCENARIO.gridConfig
    });
    hydrateScenario(sim, {
      ...MAP_OUT_OF_BOUNDS_SELECTION_SCENARIO,
      playerSelectionAfterHydrate: undefined,
      expectations: undefined
    });

    const grid = sim.getWorldPort().getWorld().grid;
    const started = beginFloorSelection(
      createFloorSelectionState(),
      grid,
      { col: -1, row: 8 },
      "replace"
    );
    const dragged = updateFloorSelection(started, grid, { col: 1, row: 9 });
    const expectedSelection = ["0,8", "0,9", "1,8", "1,9"];

    expect(sortedKeys(dragged.draft!.previewSelectedCellKeys)).toEqual(expectedSelection);
    expect(sortedKeys(dragged.draft!.cellKeys)).toEqual(expectedSelection);
    expect(sortedKeys(dragged.draft!.previewSelectedCellKeys).some((key) => key.startsWith("-"))).toBe(
      false
    );

    const committed = commitFloorSelection(dragged);
    expect(sortedKeys(committed.selectedCellKeys)).toEqual(expectedSelection);

    const outcome = sim.commitPlayerSelection({
      toolId: "haul",
      selectionModifier: "replace",
      cellKeys: committed.selectedCellKeys,
      inputShape: "rect-selection",
      currentMarkers: new Map(),
      nowMs: 0
    });

    expect(outcome.didSubmitToWorld).toBe(true);
    expect(outcome.submitResult?.accepted).toBe(true);
    expect(sortedKeys(outcome.command?.targetCellKeys ?? [])).toEqual(expectedSelection);
    expect((outcome.command?.targetCellKeys ?? []).some((key) => key.startsWith("-"))).toBe(false);

    const expectedResourceKeys = MAP_OUT_OF_BOUNDS_VALID_RESOURCE_CELLS.map((cell) => coordKey(cell)).sort();
    const pickupWorkKeys = [...sim.getWorldPort().getWorld().workItems.values()]
      .filter((item) => item.kind === "pick-up-resource" && item.status === "open")
      .map((item) => coordKey(item.anchorCell))
      .sort();

    expect(pickupWorkKeys).toEqual(expectedResourceKeys);
    expect(pickupWorkKeys).not.toContain("1,9");
  });
});
