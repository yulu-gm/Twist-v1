/**
 * 笔刷会话：拖拽中累积网格线段覆盖格（与 Phaser 解耦）。
 *
 * 本会话只保证在网内累积路径（`isInsideGrid`）。`blockedCellKeys`、实体占用等「不可用」不在此剔除，
 * 由提交/领域校验产生显式拒绝（如 MAP-003 / `map-blocked-placement` 的 `conflictCellKeys`）；
 * 与 `game/interaction/floor-selection.ts` 矩形选区分层说明一致。
 */

import { coordKey, gridLineCells, isInsideGrid, type GridCoord, type WorldGridConfig } from "../game/map";

export type BrushStrokeState = Readonly<
  | { active: false }
  | {
      active: true;
      pointerId: number;
      accumulatedKeys: ReadonlySet<string>;
      lastCell: GridCoord;
    }
>;

export function inactiveBrushStroke(): BrushStrokeState {
  return { active: false };
}

export function beginBrushStroke(
  pointerId: number,
  grid: WorldGridConfig,
  startCell: GridCoord
): BrushStrokeState {
  if (!isInsideGrid(grid, startCell)) return { active: false };
  const key = coordKey(startCell);
  return {
    active: true,
    pointerId,
    accumulatedKeys: new Set([key]),
    lastCell: startCell
  };
}

export function extendBrushStroke(
  grid: WorldGridConfig,
  state: BrushStrokeState,
  pointerId: number,
  cell: GridCoord | undefined
): BrushStrokeState {
  if (!state.active || state.pointerId !== pointerId || !cell || !isInsideGrid(grid, cell)) {
    return state;
  }
  if (cell.col === state.lastCell.col && cell.row === state.lastCell.row) {
    return state;
  }
  const segment = gridLineCells(state.lastCell, cell, grid);
  const nextKeys = new Set(state.accumulatedKeys);
  for (const c of segment) {
    nextKeys.add(coordKey(c));
  }
  return {
    active: true,
    pointerId,
    accumulatedKeys: nextKeys,
    lastCell: cell
  };
}

/**
 * 结束笔刷会话并返回覆盖格集合。
 * 值为地图模块 `coordKey` 格式的格键，与策划文档「蓝图笔刷」输出在去重集合语义上一致（见 `oh-gen-doc/交互系统.yaml`）。
 */
export function endBrushStroke(state: BrushStrokeState): ReadonlySet<string> {
  if (!state.active) return new Set();
  return new Set(state.accumulatedKeys);
}
