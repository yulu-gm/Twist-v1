import { DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

/**
 * 夜间起始时刻 + 低精力/高困意：行为系统在夜晚对 sleep 加权，期望当前目标为 sleep。
 */
export const NIGHT_FORCES_SLEEP_SCENARIO: ScenarioDefinition = {
  name: "night-forces-sleep",
  description: "夜晚时段困倦小人当前目标应为 sleep",
  seed: 0x4e_49_47_48_54,
  pawns: [
    {
      name: "NightOwl",
      cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!,
      overrides: {
        energy: 12,
        needs: { hunger: 10, rest: 88, recreation: 8 }
      }
    }
  ],
  timeConfig: { startMinuteOfDay: 18 * 60 },
  expectations: [
    {
      label: "pawn-0 以睡眠为当前目标（夜间）",
      type: "pawn-reaches-goal",
      params: { goalKind: "sleep", pawnId: "pawn-0" },
      maxTicks: 3000
    }
  ],
  manualAcceptance: {
    steps: [
      "选择本场景，确认世界时间起始于夜间（18:00）且小人 NightOwl 精力低、困意高。",
      "运行模拟，观察小人是否向床位移动且详情中目标为睡眠。"
    ],
    outcomes: [
      "自动化期望：3000 tick 内 pawn-0 的 currentGoal.kind === \"sleep\"。"
    ]
  }
};
