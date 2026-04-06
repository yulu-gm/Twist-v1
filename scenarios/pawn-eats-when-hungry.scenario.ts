import { DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

/** 低饱食 + 高饥饿，期望在 tick 预算内将当前目标稳定为进食。 */
export const PAWN_EATS_WHEN_HUNGRY_SCENARIO: ScenarioDefinition = {
  name: "pawn-eats-when-hungry",
  description: "单小人饥饿时目标应为 eat（food-1）",
  seed: 0x50_41_57_4e,
  pawns: [
    {
      name: "Hungry",
      cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!,
      overrides: {
        satiety: 5,
        needs: { hunger: 92, rest: 4, recreation: 6 }
      }
    }
  ],
  expectations: [
    {
      label: "pawn-0 以进食为当前目标",
      type: "pawn-reaches-goal",
      params: { goalKind: "eat", pawnId: "pawn-0" },
      maxTicks: 500
    }
  ],
  manualAcceptance: {
    steps: [
      "在下拉框中选择本场景，确认地图上出现名为 Hungry 的小人，且位于默认出生格之一。",
      "点击左上方运行时间（确保未长时间暂停），观察小人移动与名册/详情中的 goal、action 文案。",
      "可打开浏览器控制台查看 `[AI]` 日志，是否出现朝向食物（food-1）的移动与进食相关决策。"
    ],
    outcomes: [
      "若干秒后 Hungry 的当前目标应为「进食 / eat」，并会向食物交互点方向移动或已在使用食物点。",
      "饱食度应随进食行为回升（相对载入时的极低饱食）。",
      "与 Vitest 一致：500 tick 内 pawn-0 的 currentGoal 应为 eat。"
    ]
  }
};
