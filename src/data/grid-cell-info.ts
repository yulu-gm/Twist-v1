/**
 * 格子 hover 展示文案（mock 生物群系 + 通行状态 + 掉落物）。
 * 未来接入真实地图数据时，只需换掉此文件的实现。
 */

import {
  type GridCoord,
  type WorldGridConfig,
  coordKey,
  isWalkableCell
} from "../game/world-grid";
import { groundItemAt } from "./ground-items";

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
  grid: WorldGridConfig
): string {
  const k = coordKey(cell);
  const biome =
    MOCK_BIOME_BY_KEY[k] ??
    MOCK_BIOME_ROTATE[(cell.col + cell.row * 5) % MOCK_BIOME_ROTATE.length]!;
  const state = isWalkableCell(grid, cell) ? "可通行" : "障碍（mock 石块）";
  const item = groundItemAt(cell);
  const itemLine = item ? `\n掉落：${item.displayName} ×${item.quantity}` : "";
  return `坐标：(${cell.col}, ${cell.row})\n地形：${biome}\n状态：${state}${itemLine}`;
}
