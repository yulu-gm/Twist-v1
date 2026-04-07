/**
 * 格子 hover 展示文案：消费 `GridCellHoverReadModel` + 与 `ground-items-renderer` 同源的地面资源行。
 */

import type { WorldEntitySnapshot } from "../game/entity/entity-types";
import { collectRenderableResourceItems } from "../scenes/renderers/ground-items-renderer";

/** 与寻路/工单一致的格面摘要，由 `world-sim-bridge.buildGridCellHoverReadModel` 构造。 */
export type GridCellHoverReadModel = Readonly<{
  cell: Readonly<{ col: number; row: number }>;
  /** 地形/地块标签；当前工程未配置生物群系时为中性说明。 */
  terrainLabel: string;
  /** 与 simulationImpassableCellKeys + 网格配置阻挡合并后的不可走。 */
  simulationImpassable: boolean;
  /** `simulationImpassable` 为真时的阻挡来源简述。 */
  impassableBrief: string | null;
  /**
   * 仅在可走格上展示占用（避免与树木/墙等阻挡实体重复一行）。
   */
  occupancyBrief: string | null;
}>;

function formatStateLines(model: GridCellHoverReadModel): string {
  if (model.simulationImpassable) {
    const tail = model.impassableBrief ? `（${model.impassableBrief}）` : "";
    return `不可通行${tail}`;
  }
  const base = "可通行";
  return model.occupancyBrief ? `${base}\n${model.occupancyBrief}` : base;
}

export function formatGridCellHoverText(
  model: GridCellHoverReadModel,
  entities: Iterable<WorldEntitySnapshot>
): string {
  const { cell } = model;
  const renderable = collectRenderableResourceItems(entities);
  const atCell = renderable.filter((it) => it.cell.col === cell.col && it.cell.row === cell.row);
  const itemLines =
    atCell.length > 0
      ? atCell.map((it) => `\n掉落：${it.centerText} ×${it.stackCount}`).join("")
      : "";
  return `坐标：(${cell.col}, ${cell.row})\n地形：${model.terrainLabel}\n状态：${formatStateLines(model)}${itemLines}`;
}
