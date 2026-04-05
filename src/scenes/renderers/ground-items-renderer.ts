/**
 * ground-items-renderer：地面掉落物线框 + 名称 + 数量绘制。
 */

import Phaser from "phaser";
import type { WorldGridConfig } from "../../game/world-grid";
import { MOCK_SCATTERED_GROUND_ITEMS } from "../../data/ground-items";

export function drawGroundItemStacks(
  scene: Phaser.Scene,
  grid: WorldGridConfig,
  ox: number,
  oy: number
): void {
  const g = scene.add.graphics();
  g.setDepth(25);
  const cs = grid.cellSizePx;
  const pad = 4;

  for (const stack of MOCK_SCATTERED_GROUND_ITEMS) {
    const { col, row } = stack.cell;
    const left = ox + col * cs + pad;
    const top = oy + row * cs + pad;
    const w = cs - pad * 2;
    const h = cs - pad * 2;

    g.lineStyle(2, 0xc9b87a, 0.95);
    g.strokeRect(left, top, w, h);

    const cx = ox + (col + 0.5) * cs;
    const cy = oy + (row + 0.5) * cs;
    scene.add
      .text(cx, cy, stack.displayName, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "11px",
        color: "#e8dcc8",
        align: "center"
      })
      .setOrigin(0.5, 0.5)
      .setDepth(25);

    const rx = ox + (col + 1) * cs - pad;
    const ry = oy + (row + 1) * cs - pad;
    scene.add
      .text(rx, ry, String(stack.quantity), {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "10px",
        color: "#f0e6d2"
      })
      .setOrigin(1, 1)
      .setDepth(25);
  }
}
