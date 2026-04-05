/**
 * grid-renderer：网格线、石头格、交互点绘制。
 * 依赖 Phaser Graphics；不含任何游戏逻辑。
 */

import Phaser from "phaser";
import {
  cellCenterWorld,
  parseCoordKey,
  type GridCoord,
  type InteractionPoint,
  type ReservationSnapshot,
  type WorldGridConfig
} from "../../game/world-grid";
import type { TimeOfDayPalette } from "../../game/time-of-day";

export function drawGridLines(
  g: Phaser.GameObjects.Graphics,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  palette: TimeOfDayPalette
): void {
  const { columns, rows, cellSizePx } = grid;
  const gridW = columns * cellSizePx;
  const gridH = rows * cellSizePx;

  g.clear();
  g.lineStyle(1, palette.gridLineColor, 0.9);
  for (let c = 0; c <= columns; c++) {
    const x = ox + c * cellSizePx;
    g.lineBetween(x, oy, x, oy + gridH);
  }
  for (let r = 0; r <= rows; r++) {
    const y = oy + r * cellSizePx;
    g.lineBetween(ox, y, ox + gridW, y);
  }
  g.lineStyle(2, palette.gridBorderColor, 0.55);
  g.strokeRect(ox + 1, oy + 1, gridW - 2, gridH - 2);
}

export function drawStoneCells(
  scene: Phaser.Scene,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  cells: readonly GridCoord[]
): void {
  const cellPx = grid.cellSizePx;
  const side = Math.max(14, cellPx * 0.42);
  for (const cell of cells) {
    const pos = cellCenterWorld(grid, cell, ox, oy);
    const stone = scene.add.rectangle(pos.x, pos.y, side, side * 0.88, 0x6b6560, 1);
    stone.setStrokeStyle(1, 0x3d3830, 0.92);
  }
}

/** 与障碍实体同步的石头格绘制（避免每帧创建独立 Rectangle）。 */
export function drawStoneCellsToGraphics(
  g: Phaser.GameObjects.Graphics,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  blockedCellKeys: ReadonlySet<string>
): void {
  g.clear();
  const cellPx = grid.cellSizePx;
  const w = Math.max(14, cellPx * 0.42);
  const h = w * 0.88;
  for (const key of blockedCellKeys) {
    const cell = parseCoordKey(key);
    if (!cell) continue;
    const pos = cellCenterWorld(grid, cell, ox, oy);
    g.fillStyle(0x6b6560, 1);
    g.fillRect(pos.x - w / 2, pos.y - h / 2, w, h);
    g.lineStyle(1, 0x3d3830, 0.92);
    g.strokeRect(pos.x - w / 2, pos.y - h / 2, w, h);
  }
}

export function drawInteractionPoints(
  g: Phaser.GameObjects.Graphics,
  labelMap: Map<string, Phaser.GameObjects.Text>,
  scene: Phaser.Scene,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  reservations: ReservationSnapshot,
  palette: TimeOfDayPalette
): void {
  g.clear();
  const secondaryColor = `#${(palette.secondaryTextColor & 0xffffff).toString(16).padStart(6, "0")}`;

  const activeIds = new Set(grid.interactionPoints.map((p) => p.id));
  for (const [id, label] of labelMap) {
    if (!activeIds.has(id)) {
      label.destroy();
      labelMap.delete(id);
    }
  }

  for (const point of grid.interactionPoints) {
    const pos = cellCenterWorld(grid, point.cell, ox, oy);
    const reserved = reservations.has(point.id);
    const color =
      point.kind === "food" ? 0xc57b57 : point.kind === "bed" ? 0x5d7fa3 : 0x5ea37c;

    g.fillStyle(color, reserved ? 0.95 : 0.65);
    g.lineStyle(2, reserved ? 0xf5f1e8 : 0x1f1a16, 0.85);

    drawInteractionShape(g, point, pos);

    let label = labelMap.get(point.id);
    if (!label || !label.active) {
      if (label) labelMap.delete(point.id);
      label = scene.add
        .text(pos.x, pos.y + 18, point.kind.toUpperCase(), {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "10px",
          color: secondaryColor
        })
        .setOrigin(0.5, 0);
      labelMap.set(point.id, label);
    }
    label.setPosition(pos.x, pos.y + 18);
    label.setAlpha(reserved ? 1 : 0.8);
    label.setColor(secondaryColor);
  }
}

function drawInteractionShape(
  g: Phaser.GameObjects.Graphics,
  point: InteractionPoint,
  pos: Readonly<{ x: number; y: number }>
): void {
  if (point.kind === "bed") {
    g.fillRect(pos.x - 14, pos.y - 10, 28, 20);
    g.strokeRect(pos.x - 14, pos.y - 10, 28, 20);
  } else if (point.kind === "food") {
    g.fillCircle(pos.x, pos.y, 12);
    g.strokeCircle(pos.x, pos.y, 12);
  } else {
    g.beginPath();
    g.moveTo(pos.x, pos.y - 12);
    g.lineTo(pos.x + 12, pos.y);
    g.lineTo(pos.x, pos.y + 12);
    g.lineTo(pos.x - 12, pos.y);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }
}
