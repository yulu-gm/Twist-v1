/**
 * 格子 hover 展示文案（mock 生物群系 + 通行状态 + 地面物资投影）。
 */

import type { EntityRegistry } from "../game/entity-system";
import {
  type GridCoord,
  type WorldGridConfig,
  coordKey,
  isWalkableCell
} from "../game/world-grid";
import { groundItemAt } from "./ground-items";
import { isStorageZoneType } from "../game/storage-zone";

const MOCK_BIOME_BY_KEY: Readonly<Record<string, string>> = {
  "4,3": "mock · 营地北门",
  "6,3": "mock · 浅溪渡口",
  "8,3": "mock · 老橡树桩"
};

const MOCK_BIOME_ROTATE = [
  "mock · 草甸过渡带",
  "mock · 疏林边缘",
  "mock · 河滩晒石",
  "mock · 塌墙遗迹"
] as const;

export function formatGridCellHoverText(
  cell: GridCoord,
  grid: WorldGridConfig,
  registry: EntityRegistry
): string {
  const k = coordKey(cell);
  const biome =
    MOCK_BIOME_BY_KEY[k] ??
    MOCK_BIOME_ROTATE[(cell.col + cell.row * 5) % MOCK_BIOME_ROTATE.length]!;
  const state = isWalkableCell(grid, cell) ? "可通行" : "障碍（mock 石块）";
  const item = groundItemAt(registry, cell);
  const itemLine = item ? `\n掉落：${item.displayName} ×${item.quantity}` : "";
  const buildings = registry
    .listEntitiesAtCell(cell)
    .filter((e) => e.kind === "building")
    .map((e) => (e.buildingType === "bed" ? "床" : e.buildingType === "horseshoe_pin" ? "掷马蹄铁" : e.buildingType));
  const buildingLine =
    buildings.length > 0 ? `\n设施：${[...new Set(buildings)].join("、")}` : "";
  const inStorageZone = registry
    .listEntitiesAtCell(cell)
    .some((e) => e.kind === "zone" && isStorageZoneType(e.zoneType));
  const zoneLine = inStorageZone ? "\n区域：存储区" : "";
  return `坐标：(${cell.col}, ${cell.row})\n地形：${biome}\n状态：${state}${buildingLine}${zoneLine}${itemLine}`;
}
