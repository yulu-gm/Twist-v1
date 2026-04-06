/**
 * refactor-test：框选纯函数域回归；MAP-004 主证据以 `tests/headless/map-out-of-bounds-selection.test.ts` 为准。
 */
import { describe, expect, it } from "vitest";
import {
  beginFloorSelection,
  clearFloorSelection,
  commitFloorSelection,
  createFloorSelectionState,
  handleOutsidePointerDown,
  resolveSelectionModifier,
  updateFloorSelection
} from "../../src/game/interaction/floor-selection";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";

function sorted(set: ReadonlySet<string>): string[] {
  return [...set].sort();
}

describe("floor-selection", () => {
  it("prefers ctrl toggle over shift union when resolving modifiers", () => {
    expect(resolveSelectionModifier(false, false)).toBe("replace");
    expect(resolveSelectionModifier(true, false)).toBe("union");
    expect(resolveSelectionModifier(false, true)).toBe("toggle");
    expect(resolveSelectionModifier(true, true)).toBe("toggle");
  });

  it("replaces the current selection on a plain single-cell click", () => {
    const state = createFloorSelectionState(new Set(["0,0", "1,0"]));
    const started = beginFloorSelection(
      state,
      DEFAULT_WORLD_GRID,
      { col: 2, row: 3 },
      "replace"
    );
    const committed = commitFloorSelection(started);

    expect(sorted(committed.selectedCellKeys)).toEqual(["2,3"]);
  });

  it("replaces the current selection with an inclusive drag rectangle", () => {
    const state = createFloorSelectionState(new Set(["0,0"]));
    const started = beginFloorSelection(
      state,
      DEFAULT_WORLD_GRID,
      { col: 1, row: 1 },
      "replace"
    );
    const updated = updateFloorSelection(started, DEFAULT_WORLD_GRID, { col: 2, row: 3 });
    const committed = commitFloorSelection(updated);

    expect(sorted(committed.selectedCellKeys)).toEqual([
      "1,1",
      "1,2",
      "1,3",
      "2,1",
      "2,2",
      "2,3"
    ]);
  });

  it("unions shift selection with the existing selected cells", () => {
    const state = createFloorSelectionState(new Set(["0,0", "1,0"]));
    const started = beginFloorSelection(
      state,
      DEFAULT_WORLD_GRID,
      { col: 1, row: 0 },
      "union"
    );
    const updated = updateFloorSelection(started, DEFAULT_WORLD_GRID, { col: 2, row: 1 });
    const committed = commitFloorSelection(updated);

    expect(sorted(committed.selectedCellKeys)).toEqual([
      "0,0",
      "1,0",
      "1,1",
      "2,0",
      "2,1"
    ]);
  });

  it("toggles cells in the dragged rectangle against the existing selection", () => {
    const state = createFloorSelectionState(
      new Set([
        "0,0",
        "1,0",
        "1,1",
        "2,1"
      ])
    );
    const started = beginFloorSelection(
      state,
      DEFAULT_WORLD_GRID,
      { col: 1, row: 0 },
      "toggle"
    );
    const updated = updateFloorSelection(started, DEFAULT_WORLD_GRID, { col: 2, row: 1 });

    expect(sorted(updated.draft!.addedCellKeys)).toEqual(["2,0"]);
    expect(sorted(updated.draft!.removedCellKeys)).toEqual(["1,0", "1,1", "2,1"]);

    const committed = commitFloorSelection(updated);
    expect(sorted(committed.selectedCellKeys)).toEqual(["0,0", "2,0"]);
  });

  it("clears selection on plain outside click and preserves it with modifiers", () => {
    const state = createFloorSelectionState(new Set(["3,3", "3,4"]));

    expect(sorted(handleOutsidePointerDown(state, "replace").selectedCellKeys)).toEqual([]);
    expect(sorted(handleOutsidePointerDown(state, "union").selectedCellKeys)).toEqual([
      "3,3",
      "3,4"
    ]);
    expect(sorted(handleOutsidePointerDown(state, "toggle").selectedCellKeys)).toEqual([
      "3,3",
      "3,4"
    ]);
  });

  it("can clear the committed selection explicitly", () => {
    const state = createFloorSelectionState(new Set(["4,4"]));
    expect(sorted(clearFloorSelection(state).selectedCellKeys)).toEqual([]);
  });
});
