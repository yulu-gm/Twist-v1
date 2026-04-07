/**
 * building-renderer：从 WorldCore 绘制墙/床建筑实体与对应蓝图（施工前半透明描边）。
 */

import Phaser from "phaser";
import type { BuildingKind, WorldEntitySnapshot } from "../../game/entity/entity-types";
import { isInsideGrid, type WorldGridConfig } from "../../game/map";

/** 单格建筑/蓝图绘制；扩展 {@link BuildingKind} 时在此表注册，避免主循环堆叠分支。 */
type BuildingCellDrawer = (
  g: Phaser.GameObjects.Graphics,
  left: number,
  top: number,
  w: number,
  h: number,
  blueprint: boolean
) => void;

function drawWallCell(
  g: Phaser.GameObjects.Graphics,
  left: number,
  top: number,
  w: number,
  h: number,
  blueprint: boolean
): void {
  if (blueprint) {
    g.fillStyle(0xc4a882, 0.42);
    g.lineStyle(2, 0x9a7b3a, 0.75);
  } else {
    g.fillStyle(0x6e6258, 0.96);
    g.lineStyle(2, 0x3d3630, 0.92);
  }
  g.fillRect(left, top, w, h);
  g.strokeRect(left, top, w, h);
  if (!blueprint) {
    const m = Math.max(2, Math.floor(Math.min(w, h) * 0.12));
    g.lineStyle(1, 0x524840, 0.55);
    g.beginPath();
    g.moveTo(left + m, top + h * 0.35);
    g.lineTo(left + w - m, top + h * 0.35);
    g.moveTo(left + m, top + h * 0.65);
    g.lineTo(left + w - m, top + h * 0.65);
    g.strokePath();
  }
}

function drawBedCell(
  g: Phaser.GameObjects.Graphics,
  left: number,
  top: number,
  w: number,
  h: number,
  blueprint: boolean
): void {
  const pad = Math.max(3, Math.floor(Math.min(w, h) * 0.12));
  if (blueprint) {
    g.fillStyle(0xa8c4e8, 0.4);
    g.lineStyle(2, 0x5a7aa3, 0.78);
  } else {
    g.fillStyle(0x5d7fa3, 0.88);
    g.lineStyle(2, 0x3a556e, 0.9);
  }
  const rx = 6;
  g.fillRoundedRect(left + pad, top + pad, w - pad * 2, h - pad * 2, rx);
  g.strokeRoundedRect(left + pad, top + pad, w - pad * 2, h - pad * 2, rx);
}

const BUILDING_CELL_DRAWERS: Record<BuildingKind, BuildingCellDrawer> = {
  wall: drawWallCell,
  bed: drawBedCell
};

function isRegisteredBuildingKind(value: string | undefined): value is BuildingKind {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(BUILDING_CELL_DRAWERS, value)
  );
}

/** 同步绘制 `building` 与施工中 `blueprint`（仅已注册 {@link BuildingKind}）。 */
export function drawBuildingsAndBlueprintsToGraphics(
  g: Phaser.GameObjects.Graphics,
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  entities: Iterable<WorldEntitySnapshot>
): void {
  g.clear();
  const cs = grid.cellSizePx;
  const inset = 2;

  const list: WorldEntitySnapshot[] = [];
  for (const e of entities) {
    if (e.kind === "building" && isRegisteredBuildingKind(e.buildingKind)) {
      list.push(e);
      continue;
    }
    if (e.kind === "blueprint" && isRegisteredBuildingKind(e.blueprintKind)) {
      list.push(e);
    }
  }
  list.sort((a, b) => {
    const pri = (x: WorldEntitySnapshot) => (x.kind === "blueprint" ? 0 : 1);
    const dp = pri(a) - pri(b);
    if (dp !== 0) return dp;
    return a.id.localeCompare(b.id);
  });

  for (const e of list) {
    const blueprint = e.kind === "blueprint";
    const kindRaw = e.kind === "building" ? e.buildingKind : e.blueprintKind;
    if (!isRegisteredBuildingKind(kindRaw)) continue;

    const drawCell = BUILDING_CELL_DRAWERS[kindRaw];
    const cells = e.occupiedCells.length > 0 ? e.occupiedCells : [e.cell];
    for (const cell of cells) {
      if (!isInsideGrid(grid, cell)) continue;
      const left = ox + cell.col * cs + inset;
      const top = oy + cell.row * cs + inset;
      const w = cs - inset * 2;
      const h = cs - inset * 2;
      drawCell(g, left, top, w, h, blueprint);
    }
  }
}
