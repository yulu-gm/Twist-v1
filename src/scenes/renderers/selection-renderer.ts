/**
 * selection-renderer：框选高亮 + 任务标记圆圈绘制。
 */

import Phaser from "phaser";
import {
  coordKey,
  parseCoordKey as parseGridCoordKey,
  type GridCoord,
  type WorldGridConfig
} from "../../game/map";
import type { FloorSelectionState } from "../../game/interaction/floor-selection";
import { MAP_OVERLAY_DEPTH } from "../map-overlay-depths";

export type FloorSelectionRedrawOptions = Readonly<{
  /** 当前拖动的矩形范围内「会成为任务目标」的格（与领域过滤一致）；不传则不画预览环。 */
  draftEligibleCellKeys?: ReadonlySet<string> | null;
}>;

export function redrawFloorSelection(
  selectionGraphics: Phaser.GameObjects.Graphics,
  draftGraphics: Phaser.GameObjects.Graphics,
  state: FloorSelectionState,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  options: FloorSelectionRedrawOptions = {}
): void {
  selectionGraphics.clear();
  draftGraphics.clear();

  drawSelectionOverlay(
    selectionGraphics,
    state.selectedCellKeys,
    grid,
    ox,
    oy,
    0x81b29a,
    0.18,
    0xb8e0d2,
    0.8
  );

  const draft = state.draft;
  if (!draft) return;

  drawSelectionBoundsWireframe(draftGraphics, draft.cellKeys, grid, ox, oy, 0xf4e3b2, 0.95, 2);

  const elig = options.draftEligibleCellKeys;
  if (elig && elig.size > 0) {
    drawDraftTargetHighlights(draftGraphics, elig, grid, ox, oy, 0xd4a84b, 0.88);
  }
}

/** 拖动选区外轮廓（矩形包络），不逐格填充。 */
export function drawSelectionBoundsWireframe(
  graphics: Phaser.GameObjects.Graphics,
  cellKeys: ReadonlySet<string>,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  strokeColor: number,
  strokeAlpha: number,
  lineWidth = 2
): void {
  if (cellKeys.size === 0) return;

  let minC = Infinity;
  let maxC = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  for (const key of cellKeys) {
    const c = parseGridCoordKey(key);
    if (!c) continue;
    minC = Math.min(minC, c.col);
    maxC = Math.max(maxC, c.col);
    minR = Math.min(minR, c.row);
    maxR = Math.max(maxR, c.row);
  }
  if (minC === Infinity) return;

  const cs = grid.cellSizePx;
  const x = ox + minC * cs;
  const y = oy + minR * cs;
  const w = (maxC - minC + 1) * cs;
  const h = (maxR - minR + 1) * cs;
  graphics.lineStyle(lineWidth, strokeColor, strokeAlpha);
  graphics.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

/** 拖动中对「有效目标格」的预览环（与正式任务标记视觉接近）。 */
export function drawDraftTargetHighlights(
  graphics: Phaser.GameObjects.Graphics,
  cellKeys: ReadonlySet<string>,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  strokeColor: number,
  strokeAlpha: number
): void {
  if (cellKeys.size === 0) return;
  const cs = grid.cellSizePx;
  const radius = cs * 0.25;
  graphics.lineStyle(2, strokeColor, strokeAlpha);
  for (const key of cellKeys) {
    const coord = parseGridCoordKey(key);
    if (!coord) continue;
    const cx = ox + coord.col * cs + cs / 2;
    const cy = oy + coord.row * cs + cs / 2;
    graphics.strokeCircle(cx, cy, radius);
  }
}

/** 笔刷路径的包络框 + 有效目标高亮（与框选草稿一致）。 */
export function redrawBrushStrokeDraft(
  draftGraphics: Phaser.GameObjects.Graphics,
  accumulatedKeys: ReadonlySet<string>,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  eligibleCellKeys: ReadonlySet<string> | null | undefined
): void {
  drawSelectionBoundsWireframe(draftGraphics, accumulatedKeys, grid, ox, oy, 0xf4a261, 0.92, 2);
  if (eligibleCellKeys && eligibleCellKeys.size > 0) {
    drawDraftTargetHighlights(draftGraphics, eligibleCellKeys, grid, ox, oy, 0xd4a84b, 0.88);
  }
}

export function drawSelectionOverlay(
  graphics: Phaser.GameObjects.Graphics,
  cellKeys: ReadonlySet<string>,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  fillColor: number,
  fillAlpha: number,
  strokeColor: number,
  strokeAlpha: number
): void {
  if (cellKeys.size === 0) return;

  const cellSize = grid.cellSizePx;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.columns; col++) {
      const cell: GridCoord = { col, row };
      if (!cellKeys.has(coordKey(cell))) continue;

      const x = ox + col * cellSize;
      const y = oy + row * cellSize;
      graphics.fillStyle(fillColor, fillAlpha);
      graphics.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
      graphics.lineStyle(2, strokeColor, strokeAlpha);
      graphics.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
    }
  }
}

export function syncTaskMarkerView(
  g: Phaser.GameObjects.Graphics,
  textMap: Map<string, Phaser.GameObjects.Text>,
  scene: Phaser.Scene,
  taskMarkersByCell: ReadonlyMap<string, string>,
  grid: WorldGridConfig,
  ox: number,
  oy: number
): void {
  g.clear();
  const cs = grid.cellSizePx;
  const radius = cs * 0.25;

  // 清除已不存在的文本对象
  for (const [key, text] of [...textMap]) {
    if (!taskMarkersByCell.has(key)) {
      text.destroy();
      textMap.delete(key);
    }
  }

  g.lineStyle(2, 0xd4a84b, 0.92);

  for (const [key, taskName] of taskMarkersByCell) {
    const coord = parseGridCoordKey(key);
    if (!coord) continue;
    const cx = ox + coord.col * cs + cs / 2;
    const cy = oy + coord.row * cs + cs / 2;

    g.strokeCircle(cx, cy, radius);

    let text = textMap.get(key);
    if (!text || !text.active) {
      if (text) textMap.delete(key);
      text = scene.add
        .text(cx, cy, taskName, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "10px",
          color: "#f0e6d2",
          align: "center",
          stroke: "#000000",
          strokeThickness: 3
        })
        .setOrigin(0.5, 0.5)
        .setDepth(MAP_OVERLAY_DEPTH.taskMarkerLabel);
      textMap.set(key, text);
    } else {
      text.setText(taskName);
      text.setPosition(cx, cy);
      text.setDepth(MAP_OVERLAY_DEPTH.taskMarkerLabel);
    }
  }
}

