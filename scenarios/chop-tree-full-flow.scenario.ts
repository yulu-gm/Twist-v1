import { coordKey } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";
import type { DomainCommand } from "../src/player/s0-contract";

/** 树格；小人生成在相邻格（曼哈顿距离 1），便于一帧内走向锚格。 */
const TREE_CELL = { col: 12, row: 7 } as const;
const PAWN_CELL = { col: 11, row: 7 } as const;
const treeKey = coordKey(TREE_CELL);

const LUMBER_ON_TREE: DomainCommand = {
  commandId: "scenario-chop-tree-full-flow-lumber",
  verb: "assign_tool_task:lumber",
  targetCellKeys: [treeKey],
  targetEntityIds: [],
  sourceMode: {
    source: { kind: "toolbar", toolId: "lumber" },
    selectionModifier: "replace",
    inputShape: "rect-selection"
  }
};

/** 固定 seed：1 pawn 紧邻 1 tree、无 zone；lumber → 认领 → 抵锚读条 → 伐木落成 wood resource。 */
export const CHOP_TREE_FULL_FLOW_SCENARIO: ScenarioDefinition = {
  name: "chop-tree-full-flow",
  description: "邻树小人提交 lumber：自动认领、走格、读条后伐木完成并地面生成木材",
  seed: 0x63_68_6f_70_665f,
  pawns: [{ name: "Chopper", cell: PAWN_CELL }],
  trees: [{ cell: TREE_CELL }],
  domainCommandsAfterHydrate: [LUMBER_ON_TREE],
  expectations: [
    {
      label: "工单被认领",
      type: "event-occurred",
      params: { eventKind: "work-claimed" }
    },
    {
      label: "伐木工单在读条后落成",
      type: "event-occurred",
      params: { eventKind: "work-completed" },
      maxTicks: 1000
    },
    {
      label: "树实体已移除",
      type: "entity-kind-absent",
      params: { entityKind: "tree" }
    },
    {
      label: "地面存在物资实体",
      type: "entity-kind-exists",
      params: { entityKind: "resource" }
    }
  ],
  manualAcceptance: {
    steps: [
      "（UI-002）载入后观察 Chopper 走向树格并开始伐木，确认小人头顶进度条出现。",
      "（UI-002）在读条过程中观察进度条填充；完成后条消失，树格变为地面木材。",
      "（UI-002）打开小人详情/状态面板，确认「当前行为」与伐木阶段一致（伐木中 → 完成后随 goal 变化）。"
    ],
    outcomes: [
      "进度条可见性与 `pawn-renderer` 规则一致：认领工单、锚格读条中显示，完成后隐藏（UI-002）。",
      "世界结果与无头期望一致：树移除、原格 wood 可拾取。"
    ]
  }
};
