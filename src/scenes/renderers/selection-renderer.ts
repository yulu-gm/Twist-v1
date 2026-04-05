/**
 * selection-renderer：框选高亮 + 任务标记圆圈绘制。
 */

import Phaser from "phaser";
import {
  coordKey,
  parseCoordKey as parseGridCoordKey,
  type GridCoord,
  type WorldGridConfig
} from "../../game/map/world-grid";
import type { FloorSelectionState } from "../../game/interaction/floor-selection";

export function redrawFloorSelection(
  selectionGraphics: Phaser.GameObjects.Graphics,
  draftGraphics: Phaser.GameObjects.Graphics,
  state: FloorSelectionState,
  grid: WorldGridConfig,
  ox: number,
  oy: number
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

  if (draft.modifier === "toggle") {
    drawSelectionOverlay(draftGraphics, draft.addedCellKeys, grid, ox, oy, 0x88c0a8, 0.34, 0xd8f3dc, 0.95);
    drawSelectionOverlay(draftGraphics, draft.removedCellKeys, grid, ox, oy, 0xc1666b, 0.34, 0xffd6d9, 0.95);
    return;
  }

  drawSelectionOverlay(draftGraphics, draft.cellKeys, grid, ox, oy, 0xd2b96c, 0.2, 0xf4e3b2, 0.95);
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
        .setDepth(36);
      textMap.set(key, text);
    } else {
      text.setText(taskName);
      text.setPosition(cx, cy);
    }
  }
}

