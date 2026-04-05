import {
  rectCellKeysInclusive,
  type GridCoord,
  type WorldGridConfig
} from "./world-grid";

export type SelectionModifier = "replace" | "union" | "toggle";

export type SelectionDraft = Readonly<{
  anchorCell: GridCoord;
  focusCell: GridCoord;
  modifier: SelectionModifier;
  cellKeys: ReadonlySet<string>;
  previewSelectedCellKeys: ReadonlySet<string>;
  addedCellKeys: ReadonlySet<string>;
  removedCellKeys: ReadonlySet<string>;
}>;

export type FloorSelectionState = Readonly<{
  selectedCellKeys: ReadonlySet<string>;
  draft?: SelectionDraft;
}>;

export function createFloorSelectionState(
  selectedCellKeys: ReadonlySet<string> = new Set<string>()
): FloorSelectionState {
  return {
    selectedCellKeys: new Set(selectedCellKeys)
  };
}

export function resolveSelectionModifier(
  shiftKey: boolean,
  ctrlKey: boolean
): SelectionModifier {
  if (ctrlKey) return "toggle";
  if (shiftKey) return "union";
  return "replace";
}

export function beginFloorSelection(
  state: FloorSelectionState,
  grid: WorldGridConfig,
  anchorCell: GridCoord,
  modifier: SelectionModifier
): FloorSelectionState {
  return {
    selectedCellKeys: state.selectedCellKeys,
    draft: buildSelectionDraft(state.selectedCellKeys, grid, anchorCell, anchorCell, modifier)
  };
}

export function updateFloorSelection(
  state: FloorSelectionState,
  grid: WorldGridConfig,
  focusCell: GridCoord
): FloorSelectionState {
  const draft = state.draft;
  if (!draft) return state;

  return {
    selectedCellKeys: state.selectedCellKeys,
    draft: buildSelectionDraft(
      state.selectedCellKeys,
      grid,
      draft.anchorCell,
      focusCell,
      draft.modifier
    )
  };
}

export function commitFloorSelection(state: FloorSelectionState): FloorSelectionState {
  const draft = state.draft;
  if (!draft) return state;

  return {
    selectedCellKeys: new Set(draft.previewSelectedCellKeys)
  };
}

export function clearFloorSelection(_state?: FloorSelectionState): FloorSelectionState {
  return {
    selectedCellKeys: new Set<string>()
  };
}

export function handleOutsidePointerDown(
  state: FloorSelectionState,
  modifier: SelectionModifier
): FloorSelectionState {
  if (modifier === "replace") {
    return clearFloorSelection(state);
  }

  return {
    selectedCellKeys: new Set(state.selectedCellKeys)
  };
}

function buildSelectionDraft(
  selectedCellKeys: ReadonlySet<string>,
  grid: WorldGridConfig,
  anchorCell: GridCoord,
  focusCell: GridCoord,
  modifier: SelectionModifier
): SelectionDraft {
  const cellKeys = rectCellKeysInclusive(grid, anchorCell, focusCell);
  const previewSelectedCellKeys = new Set(selectedCellKeys);
  const addedCellKeys = new Set<string>();
  const removedCellKeys = new Set<string>();

  if (modifier === "replace") {
    previewSelectedCellKeys.clear();
    for (const key of cellKeys) {
      previewSelectedCellKeys.add(key);
      addedCellKeys.add(key);
    }
  } else if (modifier === "union") {
    for (const key of cellKeys) {
      if (!previewSelectedCellKeys.has(key)) {
        addedCellKeys.add(key);
      }
      previewSelectedCellKeys.add(key);
    }
  } else {
    for (const key of cellKeys) {
      if (previewSelectedCellKeys.has(key)) {
        previewSelectedCellKeys.delete(key);
        removedCellKeys.add(key);
        continue;
      }

      previewSelectedCellKeys.add(key);
      addedCellKeys.add(key);
    }
  }

  return {
    anchorCell,
    focusCell,
    modifier,
    cellKeys,
    previewSelectedCellKeys,
    addedCellKeys,
    removedCellKeys
  };
}
