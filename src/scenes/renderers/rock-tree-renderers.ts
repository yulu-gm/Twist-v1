/**
 * 岩石 / 树木静态格渲染（EntityRenderer）。
 */

import Phaser from "phaser";
import { cellCenterWorld, type WorldGridConfig } from "../../game/world-grid";
import type { RockEntity, TreeEntity } from "../../game/entity-system";
import type { EntityRenderer } from "./entity-view-sync";

export const rockEntityRenderer: EntityRenderer<RockEntity, Phaser.GameObjects.Rectangle> = {
  create(scene, entity, grid, ox, oy) {
    const pos = cellCenterWorld(grid, entity.cell, ox, oy);
    const cellPx = grid.cellSizePx;
    const side = Math.max(14, cellPx * 0.42);
    const stone = scene.add.rectangle(
      pos.x,
      pos.y,
      side,
      side * 0.88,
      0x6b6560,
      1
    );
    stone.setStrokeStyle(1, 0x3d3830, 0.92);
    stone.setDepth(20);
    return stone;
  },
  update(_scene, entity, view, grid, ox, oy) {
    const pos = cellCenterWorld(grid, entity.cell, ox, oy);
    view.setPosition(pos.x, pos.y);
  }
};

export const treeEntityRenderer: EntityRenderer<TreeEntity, Phaser.GameObjects.Rectangle> = {
  create(scene, entity, grid, ox, oy) {
    const pos = cellCenterWorld(grid, entity.cell, ox, oy);
    const cellPx = grid.cellSizePx;
    const side = Math.max(14, cellPx * 0.42);
    const tree = scene.add.rectangle(
      pos.x,
      pos.y - cellPx * 0.04,
      side * 0.92,
      side * 1.05,
      0x3d6b3d,
      1
    );
    tree.setStrokeStyle(1, 0x2a4a2a, 0.9);
    tree.setDepth(20);
    return tree;
  },
  update(_scene, entity, view, grid, ox, oy) {
    const pos = cellCenterWorld(grid, entity.cell, ox, oy);
    const cellPx = grid.cellSizePx;
    view.setPosition(pos.x, pos.y - cellPx * 0.04);
  }
};
