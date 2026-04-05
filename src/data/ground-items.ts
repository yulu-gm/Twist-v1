/**
 * 地面掉落物 mock 数据（每格最多一种条目 + 数量）。
 * 未来接入真实库存系统时，只需换掉此文件的实现。
 */

import { coordKey, type GridCoord } from "../game/world-grid";

export type GroundItemStack = Readonly<{
  cell: GridCoord;
  displayName: string;
  quantity: number;
}>;

/** 临时固定散落：地图左上角区域，用于验证掉落物视图。 */
export const MOCK_SCATTERED_GROUND_ITEMS: readonly GroundItemStack[] = [
  { cell: { col: 1, row: 0 }, displayName: "木柴", quantity: 3 },
  { cell: { col: 3, row: 1 }, displayName: "石块", quantity: 12 },
  { cell: { col: 0, row: 2 }, displayName: "浆果", quantity: 5 },
  { cell: { col: 2, row: 2 }, displayName: "绳结", quantity: 1 },
  { cell: { col: 4, row: 0 }, displayName: "铁矿", quantity: 7 },
  { cell: { col: 5, row: 2 }, displayName: "草药", quantity: 2 },
  { cell: { col: 0, row: 1 }, displayName: "兽皮", quantity: 4 }
];

const GROUND_ITEMS_BY_KEY: ReadonlyMap<string, GroundItemStack> = new Map(
  MOCK_SCATTERED_GROUND_ITEMS.map((s) => [coordKey(s.cell), s])
);

export function groundItemAt(cell: GridCoord): GroundItemStack | undefined {
  return GROUND_ITEMS_BY_KEY.get(coordKey(cell));
}
