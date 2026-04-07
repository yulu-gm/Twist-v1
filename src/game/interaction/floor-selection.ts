import {
  rectCellKeysInclusive,
  type GridCoord,
  type WorldGridConfig
} from "../map/world-grid";

/**
 * 楼面选区：矩形框选与修饰键（replace / union / toggle）下的格键集合合并。
 *
 * 产出仅为「地图网格内矩形格键 + 修饰键合并结果」；超界格由 `rectCellKeysInclusive` / world-grid 裁剪。
 * 「不可用格」（可通行、占用等）默认仍由上层在提交前校验；若产品要求在框选阶段即排除不可选格，可在
 * {@link beginFloorSelection} 传入可选 `filterCellKey`。请勿将 {@link commitFloorSelection} 的选中集合
 * 等同于策划文档中的完整「选区解析器」输出（除非上层已叠加同等过滤）。
 */

export type SelectionModifier = "replace" | "union" | "toggle";

export type SelectionDraft = Readonly<{
  anchorCell: GridCoord;
  focusCell: GridCoord;
  modifier: SelectionModifier;
  /** 若存在，与 {@link beginFloorSelection} 传入的裁剪函数相同，供拖拽更新时复用。 */
  filterCellKey?: (key: string) => boolean;
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
  modifier: SelectionModifier,
  options?: Readonly<{ filterCellKey?: (key: string) => boolean }>
): FloorSelectionState {
  const filterCellKey = options?.filterCellKey;
  return {
    selectedCellKeys: state.selectedCellKeys,
    draft: buildSelectionDraft(
      state.selectedCellKeys,
      grid,
      anchorCell,
      anchorCell,
      modifier,
      filterCellKey
    )
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
      draft.modifier,
      draft.filterCellKey
    )
  };
}

/** 将草稿预览写回已选格键；不包含不可用格过滤。 */
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
  modifier: SelectionModifier,
  filterCellKey?: (key: string) => boolean
): SelectionDraft {
  const rawKeys = rectCellKeysInclusive(grid, anchorCell, focusCell);
  const cellKeys = filterCellKey
    ? new Set([...rawKeys].filter(filterCellKey))
    : rawKeys;
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
    ...(filterCellKey !== undefined ? { filterCellKey } : {}),
    cellKeys,
    previewSelectedCellKeys,
    addedCellKeys,
    removedCellKeys
  };
}
