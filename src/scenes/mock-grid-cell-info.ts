import {
  type GridCoord,
  type WorldGridConfig,
  coordKey,
  isWalkableCell
} from "../game/world-grid";
import { mockGroundItemAt } from "./mock-ground-items";

/** 表现层 mock：格子的展示文案，非权威游戏数据。 */
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

export function formatMockGridCellHoverText(
  cell: GridCoord,
  grid: WorldGridConfig
): string {
  const k = coordKey(cell);
  const biome =
    MOCK_BIOME_BY_KEY[k] ??
    MOCK_BIOME_ROTATE[(cell.col + cell.row * 5) % MOCK_BIOME_ROTATE.length]!;
  const state = isWalkableCell(grid, cell) ? "可通行" : "障碍（mock 石块）";
  const item = mockGroundItemAt(cell);
  const itemLine = item ? `\n掉落：${item.displayName} ×${item.quantity}` : "";
  return `坐标：(${cell.col}, ${cell.row})\n地形：${biome}\n状态：${state}${itemLine}`;
}
