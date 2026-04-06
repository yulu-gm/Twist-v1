import { coordKey } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";
import type { DomainCommand } from "../src/player/s0-contract";

/** 自动下 lumber 指令的树格；小人生成在相邻格（曼哈顿距离 1），便于一帧内走向锚格。 */
const TREE_CELL = { col: 12, row: 7 } as const;
const PAWN_CELL = { col: 11, row: 7 } as const;
const treeKey = coordKey(TREE_CELL);

/** 同场景额外树：供手动再选区伐木回归，不影响无头仅砍 `TREE_CELL` 的期望。 */
const EXTRA_TREE_CELLS = [
  { col: 13, row: 7 },
  { col: 12, row: 6 },
  { col: 11, row: 6 },
  { col: 10, row: 7 }
] as const;

const LUMBER_ON_TREE: DomainCommand = {
  commandId: "scenario-chop-tree-full-flow-lumber",
  verb: "assign_tool_task:lumber",
  targetCellKeys: [treeKey],
  targetEntityIds: [],
  sourceMode: {
    source: { kind: "menu", menuId: "orders", itemId: "lumber" },
    selectionModifier: "replace",
    inputShape: "rect-selection"
  }
};

/** 固定 seed：1 pawn、多棵树（首棵紧邻）、无 zone；首棵 lumber → 认领 → 读条 → 该格落成 wood；其余树可手动再测。 */
export const CHOP_TREE_FULL_FLOW_SCENARIO: ScenarioDefinition = {
  name: "chop-tree-full-flow",
  description: "邻树小人提交 lumber（首棵）：自动认领、走格、读条后该树移除并地面生成木材；场内仍有其他树可手动再下达指令",
  seed: 0x63_68_6f_70_665f,
  pawns: [{ name: "Chopper", cell: PAWN_CELL }],
  trees: [{ cell: TREE_CELL }, ...EXTRA_TREE_CELLS.map((cell) => ({ cell }))],
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
      label: "目标格树已移除",
      type: "entity-kind-absent",
      params: { entityKind: "tree", cell: TREE_CELL }
    },
    {
      label: "地面存在物资实体",
      type: "entity-kind-exists",
      params: { entityKind: "resource" }
    }
  ],
  manualAcceptance: {
    steps: [
      "（UI-002）载入后观察 Chopper 走向首棵目标树格并开始伐木，确认小人头顶进度条出现。",
      "（UI-002）在读条过程中观察进度条填充；完成后条消失，该树格变为地面木材。",
      "（UI-002）打开小人详情/状态面板，确认「当前行为」与伐木阶段一致（伐木中 → 完成后随 goal 变化）。",
      "再次选择 lumber 工具并对场上其余树格下指令，确认可重复走认领→读条→该格落木材流程。"
    ],
    outcomes: [
      "进度条可见性与 `pawn-renderer` 规则一致：认领工单、锚格读条中显示，完成后隐藏（UI-002）。",
      "世界结果与无头期望一致：首棵目标格树移除、该格 wood 可拾取；多树场景下可手动验证第二次伐木。"
    ]
  }
};
