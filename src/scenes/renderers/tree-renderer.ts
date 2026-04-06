/**
 * tree-renderer：从 WorldCore 树实体同步绘制树冠（三角）与树干。
 */

import Phaser from "phaser";
import type { WorldEntitySnapshot } from "../../game/entity/entity-types";
import { cellCenterWorld, type WorldGridConfig } from "../../game/map/world-grid";

export function drawTreesToGraphics(
  g: Phaser.GameObjects.Graphics,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  entities: Iterable<WorldEntitySnapshot>
): void {
  g.clear();
  const cellPx = grid.cellSizePx;
  for (const e of entities) {
    if (e.kind !== "tree") continue;
    const pos = cellCenterWorld(grid, e.cell, ox, oy);
    const marked = e.loggingMarked === true;
    const w = cellPx * 0.38;
    const h = cellPx * 0.42;
    const fill = marked ? 0xc45c26 : 0x2d8a3e;
    const stroke = marked ? 0xfff3c4 : 0x1a4d24;
    const lineW = marked ? 3 : 1.5;
    g.fillStyle(fill, marked ? 1 : 0.92);
    g.lineStyle(lineW, stroke, marked ? 1 : 0.9);
    g.beginPath();
    g.moveTo(pos.x, pos.y - h * 0.85);
    g.lineTo(pos.x + w, pos.y + h * 0.15);
    g.lineTo(pos.x - w, pos.y + h * 0.15);
    g.closePath();
    g.fillPath();
    g.strokePath();
    const tw = cellPx * 0.08;
    const th = cellPx * 0.22;
    g.fillStyle(marked ? 0x5c3d2e : 0x4a3528, 1);
    g.fillRect(pos.x - tw / 2, pos.y + h * 0.12, tw, th);
  }
}
