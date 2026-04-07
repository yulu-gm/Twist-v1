/**
 * tree-renderer：从 WorldCore 树实体同步绘制树冠（三角）与树干。
 */

import Phaser from "phaser";
import type { TreeLoggingVisualPhase, WorldEntitySnapshot } from "../../game/entity/entity-types";
import { cellCenterWorld, type WorldGridConfig } from "../../game/map";
import { TREE_RENDER_THEME, TREE_SHAPE_RATIOS } from "./tree-visual-theme";

function resolveTreeLoggingPhase(entity: WorldEntitySnapshot): TreeLoggingVisualPhase {
  if (entity.treeLoggingVisualPhase !== undefined) return entity.treeLoggingVisualPhase;
  if (entity.loggingMarked === true) return "marked";
  return "normal";
}

export function drawTreesToGraphics(
  g: Phaser.GameObjects.Graphics,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  entities: Iterable<WorldEntitySnapshot>
): void {
  g.clear();
  const cellPx = grid.cellSizePx;
  const { crownWidth, crownHeight, trunkWidth, trunkHeight, crownTipY, crownBaseY, trunkTopY } =
    TREE_SHAPE_RATIOS;

  for (const e of entities) {
    if (e.kind !== "tree") continue;
    const pos = cellCenterWorld(grid, e.cell, ox, oy);
    const phase = resolveTreeLoggingPhase(e);
    const style = TREE_RENDER_THEME[phase];
    const w = cellPx * crownWidth;
    const h = cellPx * crownHeight;
    g.fillStyle(style.foliageFill, style.foliageFillAlpha);
    g.lineStyle(style.foliageLineWidth, style.foliageStroke, style.foliageStrokeAlpha);
    g.beginPath();
    g.moveTo(pos.x, pos.y - h * crownTipY);
    g.lineTo(pos.x + w, pos.y + h * crownBaseY);
    g.lineTo(pos.x - w, pos.y + h * crownBaseY);
    g.closePath();
    g.fillPath();
    g.strokePath();
    const tw = cellPx * trunkWidth;
    const th = cellPx * trunkHeight;
    g.fillStyle(style.trunkFill, style.trunkFillAlpha);
    g.fillRect(pos.x - tw / 2, pos.y + h * trunkTopY, tw, th);
  }
}
