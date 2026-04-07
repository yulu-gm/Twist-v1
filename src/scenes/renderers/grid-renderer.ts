/**
 * grid-renderer：网格线与外框描边。
 * 依赖 Phaser Graphics；不含任何游戏逻辑。
 */

import Phaser from "phaser";
import type { WorldGridConfig } from "../../game/world-grid";
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
