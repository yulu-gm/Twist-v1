import { DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

/** 低精力 + 高困意，期望将当前目标切到睡眠（床位交互）。 */
export const PAWN_SLEEPS_WHEN_TIRED_SCENARIO: ScenarioDefinition = {
  name: "pawn-sleeps-when-tired",
  description: "单小人困倦时目标应为 sleep",
  seed: 0x53_4c_45_45_50,
  pawns: [
    {
      name: "Sleepy",
      cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!,
      overrides: {
        energy: 5,
        needs: { hunger: 6, rest: 92, recreation: 6 }
      }
    }
  ],
  expectations: [
    {
      label: "pawn-0 以睡眠为当前目标",
      type: "pawn-reaches-goal",
      params: { goalKind: "sleep", pawnId: "pawn-0" },
      maxTicks: 500
    }
  ],
  manualAcceptance: {
    steps: [
      "选择本场景，确认小人 Sleepy 出现且精力条/数值明显偏低（场景 overrides）。",
      "运行模拟，观察小人是否向床位（bed-1 等）移动。",
      "在名册中选中 Sleepy，阅读详情里的 debugLabel / 目标与动作是否与睡眠一致。"
    ],
    outcomes: [
      "当前目标应切为「睡眠 / sleep」，并趋向床位交互点。",
      "精力应在使用床位、休息结束后逐步恢复。",
      "自动化期望：500 tick 内 `pawn-0` 的 `currentGoal.kind === \"sleep\"`。"
    ]
  }
};
