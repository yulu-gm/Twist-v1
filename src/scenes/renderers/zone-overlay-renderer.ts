/**
 * zone-overlay-renderer：从 WorldCore 筛选 `kind==="zone"` ，按 coveredCells 绘制半透明蓝底与浅色描边。
 */

import Phaser from "phaser";
import type { WorldEntitySnapshot } from "../../game/entity/entity-types";
import { isInsideGrid, type WorldGridConfig } from "../../game/map/world-grid";

export function drawZoneOverlaysToGraphics(
  g: Phaser.GameObjects.Graphics,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  entities: Iterable<WorldEntitySnapshot>
): void {
  g.clear();
  const cs = grid.cellSizePx;
  const inset = 1;
  const fillColor = 0x3d7dd9;
  const fillAlpha = 0.26;
  const borderColor = 0xb8dcff;
  const borderAlpha = 0.62;

  const zones: WorldEntitySnapshot[] = [];
  for (const e of entities) {
    if (e.kind === "zone") zones.push(e);
  }
  zones.sort((a, b) => a.id.localeCompare(b.id));

  for (const e of zones) {
    const cells = e.coveredCells;
    if (!cells || cells.length === 0) continue;

    for (const cell of cells) {
      if (!isInsideGrid(grid, cell)) continue;
      const left = ox + cell.col * cs + inset;
      const top = oy + cell.row * cs + inset;
      const w = cs - inset * 2;
      const h = cs - inset * 2;
      g.fillStyle(fillColor, fillAlpha);
      g.fillRect(left, top, w, h);
      g.lineStyle(1, borderColor, borderAlpha);
      g.strokeRect(left, top, w, h);
    }
  }
}
