import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

/** 与床场景错开一行：与正式 UI 相同 — `工具:建造` + 墙笔刷抬起，单格亦为 brush-stroke。 */
const WALL_CELL = { col: 11, row: 6 } as const;

/** 固定 seed：1 小人；玩家式提交后生成 construct-blueprint 工单再认领建造。 */
export const BUILD_WALL_FLOW_SCENARIO: ScenarioDefinition = {
  name: "build-wall-flow",
  description: "玩家路径 build+墙笔刷 → 空闲小人自动认领走向锚格并落成墙实体",
  seed: 0x57_41_4c_4c_46,
  pawns: [{ name: "WallBuilder", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! }],
  playerSelectionAfterHydrate: [
    {
      commandId: "build-wall",
      selectionModifier: "replace",
      cellKeys: [coordKey(WALL_CELL)],
      inputShape: "brush-stroke"
    }
  ],
  expectations: [
    {
      label: "装载后存在蓝图建造工单",
      type: "work-item-exists",
      params: { workKind: "construct-blueprint" }
    },
    {
      label: "construct-blueprint 工单已完成（世界状态）",
      type: "work-item-completed-kind",
      params: { workKind: "construct-blueprint" },
      maxTicks: 4_000
    },
    {
      label: "目标格已落成墙建筑实体",
      type: "building-present",
      params: { buildingKind: "wall", cell: WALL_CELL }
    }
  ],
  manualAcceptance: {
    steps: [
      "（UI-001）在实机中打开工具栏，依次点「建造」→「木墙」，确认子菜单展开且「木墙」呈选中高亮。",
      "（UI-001）查看左上角玩家通道提示，确认文案已进入木墙笔刷模式（与 presentationForCommandMenuCommand('build-wall') 一致）。",
      "选择本场景：出生点 WallBuilder；与实机相同，装载后已在 (11,6) 执行一次「建造→墙笔刷」提交。",
      "与实机一致：装载后不手工认领；下一帧起由 `autoClaimOpenWorkItems` 分配 construct-blueprint。"
    ],
    outcomes: [
      "层级菜单与通道提示与当前建造子模式一致（UI-001）。",
      "自动认领后小人沿格走向锚格，落成 `buildingKind: wall`（与无头期望一致）。"
    ]
  }
};
