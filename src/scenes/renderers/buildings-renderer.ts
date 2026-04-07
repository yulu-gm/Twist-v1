/**
 * buildings-renderer：建筑占位图形（EntityRenderer）。
 */

import Phaser from "phaser";
import { primaryCellOfBuildingEntity, type BuildingEntity } from "../../game/entity-system";
import type { WorldGridConfig } from "../../game/world-grid";
import type { EntityRenderer } from "./entity-view-sync";

function buildingLabel(b: BuildingEntity): string {
  switch (b.buildingType) {
    case "bed":
      return "床";
    case "bedRoll":
      return "铺盖";
    case "horseshoe_pin":
      return "掷马蹄铁";
    case "horseshoe":
      return "马蹄铁";
    case "workshop":
      return "工坊";
    case "stockpile":
      return "堆放";
    case "wall":
      return "墙";
    default:
      return b.buildingType;
  }
}

type BuildingView = Phaser.GameObjects.Container & {
  __g: Phaser.GameObjects.Graphics;
  __label: Phaser.GameObjects.Text;
};

function redrawBuildingGfx(
  view: BuildingView,
  b: BuildingEntity,
  grid: WorldGridConfig,
  ox: number,
  oy: number
): void {
  const cell = primaryCellOfBuildingEntity(b);
  if (!cell) return;
  const cs = grid.cellSizePx;
  const pad = 6;
  const { col, row } = cell;
  const left = col * cs + pad;
  const top = row * cs + pad;
  const w = cs - pad * 2;
  const h = cs - pad * 2;
  view.setPosition(ox, oy);
  const g = view.__g;
  g.clear();
  g.setPosition(0, 0);

  if (b.buildingType === "bed" || b.buildingType === "bedRoll") {
    const ry = top + h * 0.22;
    const rh = h * 0.56;
    g.fillStyle(0x6b5344, 0.88);
    g.fillRoundedRect(left, ry, w, rh, 5);
    g.lineStyle(2, 0xc9a882, 0.95);
    g.strokeRoundedRect(left, ry, w, rh, 5);
  } else if (b.buildingType === "horseshoe" || b.buildingType === "horseshoe_pin") {
    const cx = (col + 0.5) * cs;
    const cy = (row + 0.5) * cs;
    const r = Math.min(w, h) * 0.38;
    g.lineStyle(3, 0xb8483c, 0.92);
    g.strokeCircle(cx, cy, r);
    g.lineStyle(2, 0x8b5a2b, 0.85);
    g.beginPath();
    g.arc(cx, cy, r * 0.55, -Math.PI * 0.15, Math.PI * 0.65);
    g.strokePath();
    g.fillStyle(0x5c3d2e, 1);
    g.fillCircle(cx + r * 0.1, cy - r * 0.08, 4);
  } else {
    g.fillStyle(0x5a6570, 0.55);
    g.fillRect(left, top, w, h);
    g.lineStyle(2, 0x8a949e, 0.8);
    g.strokeRect(left, top, w, h);
  }

  const lx = (col + 0.5) * cs;
  const ly = (row + 1) * cs - 4;
  view.__label.setPosition(lx, ly);
  view.__label.setText(buildingLabel(b));
}

export const buildingEntityRenderer: EntityRenderer<BuildingEntity, BuildingView> = {
  shouldRender: (b) => primaryCellOfBuildingEntity(b) != null,
  create(scene, entity, grid, ox, oy) {
    const c = scene.add.container(0, 0) as BuildingView;
    const g = scene.add.graphics();
    c.__g = g;
    c.add(g);
    const label = scene.add.text(0, 0, "", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "10px",
      color: "#dbc9ae",
      align: "center"
    });
    label.setOrigin(0.5, 1);
    c.__label = label;
    c.add(label);
    c.setDepth(24);
    redrawBuildingGfx(c, entity, grid, ox, oy);
    return c;
  },
  update(_scene, entity, view, grid, ox, oy) {
    redrawBuildingGfx(view, entity, grid, ox, oy);
  }
};
