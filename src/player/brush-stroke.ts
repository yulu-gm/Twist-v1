/**
 * 笔刷会话：拖拽中累积网格线段覆盖格（与 Phaser 解耦）。
 */

import { coordKey, gridLineCells, isInsideGrid, type GridCoord, type WorldGridConfig } from "../game/map/world-grid";

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
  const segment = gridLineCells(state.lastCell, cell);
  const nextKeys = new Set(state.accumulatedKeys);
  for (const c of segment) {
    if (isInsideGrid(grid, c)) nextKeys.add(coordKey(c));
  }
  return {
    active: true,
    pointerId,
    accumulatedKeys: nextKeys,
    lastCell: cell
  };
}

export function endBrushStroke(state: BrushStrokeState): ReadonlySet<string> {
  if (!state.active) return new Set();
  return new Set(state.accumulatedKeys);
}
