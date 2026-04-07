import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";
import type { DomainCommand } from "../src/game/interaction/domain-command-types";

const TREE_CELL = { col: 10, row: 5 } as const;

const LUMBER_ON_TREE: DomainCommand = {
  commandId: "scenario-need-interrupt-lumber",
  verb: "assign_tool_task:lumber",
  targetCellKeys: [coordKey(TREE_CELL)],
  targetEntityIds: [],
  sourceMode: {
    source: { kind: "menu", menuId: "tools", itemId: "lumber" },
    selectionModifier: "replace",
    inputShape: "rect-selection"
  }
};

/**
 * 饥饿小人认领伐木工单后因 need-interrupt-hunger 释放工单，并转向食物交互点（food-1）。
 */
export const NEED_INTERRUPT_DURING_WORK_SCENARIO: ScenarioDefinition = {
  name: "need-interrupt-during-work",
  description: "工作中饥饿紧急 → 释放 chop-tree 工单并转为 eat",
  seed: 0x6e_65_65_64_69,
  pawns: [
    {
      name: "HungryLumber",
      cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!,
      overrides: {
        satiety: 5,
        needs: { hunger: 92, rest: 10, recreation: 20 }
      }
    }
  ],
  trees: [{ cell: TREE_CELL }],
  domainCommandsAfterHydrate: [LUMBER_ON_TREE],
  expectations: [
    {
      label: "pawn-0 转向进食目标",
      type: "pawn-reaches-goal",
      params: { goalKind: "eat", pawnId: "pawn-0" },
      maxTicks: 2000
    },
    {
      label: "无人饿死（饱食度保持 ≥1）",
      type: "no-pawn-starved",
      params: { minSatiety: 1 },
      maxTicks: 5000
    }
  ],
  manualAcceptance: {
    steps: [
      "选择本场景，确认树在 (10,5)、小人生于默认出生格且初始饱食极低。",
      "运行模拟：应先认领伐木，再因饥饿中断工单，随后走向食物点。"
    ],
    outcomes: [
      "chop-tree 工单在中断后回到 open；小人 currentGoal 变为 eat；控制台可出现 need-interrupt-hunger 日志。"
    ]
  }
};
