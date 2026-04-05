/**
 * 建筑规格目录：静态定义占地、通行、交互与建成规则引用（与 oh-code-design/建筑系统 对齐）。
 *
 * `cellOffsetsFromAnchor` 为相对锚点格的偏移，`{ col: 0, row: 0 }` 表示锚点自身占格。
 */
import type { BuildingKind, InteractionCapability } from "../entity/entity-types";
import type { GridCoord } from "../map/world-grid";

/**
 * 建成后可由「建成结算器」等模块消费的规则 id。
 * 以字符串保留扩展空间；以下为约定标识，非穷举。
 * - `assign-bed-ownership`：木床建成后参与床铺归属
 * - `refresh-pathfinding-cache`：阻挡关系变化后刷新寻路缓存（预留）
 */
export type OnCompleteRuleId = string;

export type BuildingSpec = Readonly<{
  /** 与实体上的 `buildingKind` / `blueprintKind` 一致。 */
  buildingKind: BuildingKind;
  /** 相对锚点格的占格偏移（含原点）。 */
  cellOffsetsFromAnchor: readonly GridCoord[];
  /** 建成后是否阻挡小人通行（蓝图阶段是否阻挡由独立规则决定，此字段描述成品语义）。 */
  blocksMovement: boolean;
  /** 建成后实体携带的交互能力（蓝图阶段可为空）。 */
  interactionCapabilities: readonly InteractionCapability[];
  /** 建成后附加规则 id 列表（数据驱动，结算器读取）。 */
  onCompleteRules: readonly OnCompleteRuleId[];
}>;

export const BUILDING_SPECS: Record<string, BuildingSpec> = {
  wall: {
    buildingKind: "wall",
    cellOffsetsFromAnchor: [{ col: 0, row: 0 }],
    blocksMovement: true,
    interactionCapabilities: [],
    onCompleteRules: []
  },
  bed: {
    buildingKind: "bed",
    cellOffsetsFromAnchor: [{ col: 0, row: 0 }],
    blocksMovement: false,
    interactionCapabilities: ["rest"],
    onCompleteRules: ["assign-bed-ownership"]
  }
};

export function getBuildingSpec(type: string): BuildingSpec | undefined {
  return BUILDING_SPECS[type];
}
