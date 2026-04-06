import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";
import type { DomainCommand } from "../src/player/s0-contract";

const TREE_CELL = { col: 10, row: 5 } as const;
const treeKey = coordKey(TREE_CELL);

const LUMBER_ON_TREE: DomainCommand = {
  commandId: "scenario-chop-tree-lumber",
  verb: "assign_tool_task:lumber",
  targetCellKeys: [treeKey],
  targetEntityIds: [],
  sourceMode: {
    source: { kind: "toolbar", toolId: "lumber" },
    selectionModifier: "replace",
    inputShape: "rect-selection"
  }
};

/** 固定 seed：1 树 + 1 小人；装载后提交 lumber 以生成 chop-tree 工单（供无头期望与浏览器选场景）。 */
export const CHOP_TREE_COMMAND_SCENARIO: ScenarioDefinition = {
  name: "chop-tree-command",
  description: "toolbar lumber → 未标记树登记为待伐并生成 chop-tree 开放工单",
  seed: 0x63_68_6f_70_7472,
  pawns: [{ name: "Lumber", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! }],
  trees: [{ cell: TREE_CELL }],
  domainCommandsAfterHydrate: [LUMBER_ON_TREE],
  expectations: [
    {
      label: "已生成 chop-tree 开放工单",
      type: "work-item-exists",
      params: { workKind: "chop-tree", status: "open" }
    }
  ]
};
