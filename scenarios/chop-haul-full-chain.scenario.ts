import { coordKey } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";
import type { DomainCommand } from "../src/game/interaction/domain-command-types";

/** 树格；小人生成在相邻格（曼哈顿距离 1）。 */
const TREE_CELL = { col: 12, row: 7 } as const;
const PAWN_CELL = { col: 11, row: 7 } as const;
const treeKey = coordKey(TREE_CELL);

/** 存储区在树东侧，不与树/小人初始格重叠（T-03b zones）。 */
const STORAGE_ZONE_CELLS = [
  { col: 13, row: 7 },
  { col: 14, row: 7 }
] as const;

const LUMBER_ON_TREE: DomainCommand = {
  commandId: "scenario-chop-haul-full-chain-lumber",
  verb: "assign_tool_task:lumber",
  targetCellKeys: [treeKey],
  targetEntityIds: [],
  sourceMode: {
    source: { kind: "menu", menuId: "tools", itemId: "lumber" },
    selectionModifier: "replace",
    inputShape: "rect-selection"
  }
};

/** 固定 seed：1 pawn、1 tree、1 storage zone；lumber → 伐木 → 拾取 → 搬运入库。 */
export const CHOP_HAUL_FULL_CHAIN_SCENARIO: ScenarioDefinition = {
  name: "chop-haul-full-chain",
  description: "邻树 lumber + 存储区：chop-tree → pick-up-resource → haul-to-zone，木材进入 zone",
  seed: 0x63_68_5f_68_61_75_6c,
  pawns: [{ name: "Chopper", cell: PAWN_CELL }],
  trees: [{ cell: TREE_CELL }],
  zones: [{ cells: [...STORAGE_ZONE_CELLS], zoneKind: "storage" }],
  domainCommandsAfterHydrate: [LUMBER_ON_TREE],
  expectations: [
    {
      label: "树已移除",
      type: "entity-kind-absent",
      params: { entityKind: "tree" },
      maxTicks: 2000
    },
    {
      label: "物资已在存储区容器中",
      type: "resource-in-container",
      params: { containerKind: "zone" },
      maxTicks: 5000
    },
    {
      label: "伐木工单已完成",
      type: "work-item-completed-kind",
      params: { workKind: "chop-tree" }
    },
    {
      label: "拾取工单已完成",
      type: "work-item-completed-kind",
      params: { workKind: "pick-up-resource" }
    },
    {
      label: "搬运工单已完成",
      type: "work-item-completed-kind",
      params: { workKind: "haul-to-zone" }
    }
  ]
};
