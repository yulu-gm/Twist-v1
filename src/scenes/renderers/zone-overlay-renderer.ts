/**
 * zone-overlay-renderer：从 WorldCore 筛选 `kind==="zone"`，按 coveredCells 绘制半透明蓝底与浅色描边，并为连续 storage 组挂标签。
 */

import Phaser from "phaser";
import type { WorldEntitySnapshot } from "../../game/entity/entity-types";
import { listStorageGroupLabels } from "../../game/map/storage-zones";
import { coordKey, isInsideGrid, type GridCoord, type WorldGridConfig } from "../../game/map/world-grid";

export type StorageZoneLabelGroup = Readonly<{
  key: string;
  anchor: GridCoord;
  cells: readonly GridCoord[];
  text: string;
}>;

function cloneCell(cell: GridCoord): GridCoord {
  return { col: cell.col, row: cell.row };
}

function groupKey(cells: readonly GridCoord[]): string {
  return cells
    .map((cell) => coordKey(cell))
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

function collectConnectedGroups(cells: readonly GridCoord[]): GridCoord[][] {
  const cellKeys = new Set(cells.map((cell) => coordKey(cell)));
  const visited = new Set<string>();
  const groups: GridCoord[][] = [];

  const neighbors = (cell: GridCoord): GridCoord[] => [
    { col: cell.col + 1, row: cell.row },
    { col: cell.col - 1, row: cell.row },
    { col: cell.col, row: cell.row + 1 },
    { col: cell.col, row: cell.row - 1 }
  ];

  for (const start of cells) {
    const startKey = coordKey(start);
    if (visited.has(startKey)) continue;

    const queue: GridCoord[] = [start];
    visited.add(startKey);
    const group: GridCoord[] = [];

    while (queue.length > 0) {
      const cell = queue.shift()!;
      group.push(cloneCell(cell));

      for (const next of neighbors(cell)) {
        const nextKey = coordKey(next);
        if (!cellKeys.has(nextKey) || visited.has(nextKey)) continue;
        visited.add(nextKey);
        queue.push(next);
      }
    }

    group.sort((a, b) => a.row - b.row || a.col - b.col);
    groups.push(group);
  }

  return groups;
}

export function collectStorageZoneLabelGroups(
  entities: Iterable<WorldEntitySnapshot>,
  grid?: WorldGridConfig
): StorageZoneLabelGroup[] {
  const zones = [...entities].filter((entity) => entity.kind === "zone");
  const labels = listStorageGroupLabels(zones);
  const storageCells: GridCoord[] = [];

  for (const entity of zones) {
    if (entity.zoneKind !== "storage") continue;
    for (const cell of entity.coveredCells ?? []) {
      if (grid && !isInsideGrid(grid, cell)) continue;
      storageCells.push(cloneCell(cell));
    }
  }

  const cellsByGroupKey = new Map(
    collectConnectedGroups(storageCells).map((cells) => [groupKey(cells), cells] as const)
  );

  return labels.map((label) => ({
    key: label.groupKey,
    anchor: cloneCell(label.anchorCell),
    cells: cellsByGroupKey.get(label.groupKey) ?? [cloneCell(label.anchorCell)],
    text: label.text
  }));
}

export function drawZoneOverlaysToGraphics(
  g: Phaser.GameObjects.Graphics,
  labelMap: Map<string, Phaser.GameObjects.Text>,
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

  const groups = collectStorageZoneLabelGroups(zones, grid);
  const activeKeys = new Set<string>();
  for (const group of groups) {
    activeKeys.add(group.key);
    const left = ox + group.anchor.col * cs + inset * 2 + 1;
    const top = oy + group.anchor.row * cs + inset * 2 + 1;

    let label = labelMap.get(group.key);
    if (!label || !label.active) {
      if (label) labelMap.delete(group.key);
      label = g.scene.add
        .text(left, top, group.text, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "12px",
          color: "#eaf4ff",
          align: "left"
        })
        .setOrigin(0, 0)
        .setDepth(32);
      labelMap.set(group.key, label);
    }

    label.setText(group.text);
    label.setPosition(left, top);
    label.setColor("#eaf4ff");
    label.setDepth(32);
  }

  for (const [key, label] of labelMap) {
    if (!activeKeys.has(key)) {
      label.destroy();
      labelMap.delete(key);
    }
  }
}
