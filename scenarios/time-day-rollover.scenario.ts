import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map/world-grid";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

const PAWN_CELL = DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!;

/** 接近日终，少量推进即可跨过午夜并进入下一天。 */
export const TIME_DAY_ROLLOVER_SCENARIO: ScenarioDefinition = {
  name: "time-day-rollover",
  description: "接近 24:00 的时间场景，验证跨天后 dayNumber 递增与 minuteOfDay 归一",
  seed: 0x54_49_4d_45_32,
  pawns: [
    {
      name: "Rollover",
      cell: PAWN_CELL,
      overrides: {
        satiety: 90,
        energy: 90,
        needs: { hunger: 4, rest: 4, recreation: 4 }
      }
    }
  ],
  timeConfig: { startMinuteOfDay: 23 * 60 + 59.4 },
  playerSelectionAfterHydrate: [
    {
      label: "observe-day-rollover",
      toolId: "idle",
      selectionModifier: "replace",
      cellKeys: [coordKey(PAWN_CELL)],
      inputShape: "single-cell",
      semantics: "no-tool"
    }
  ],
  tickScheduleAfterHydrate: [500],
  manualAcceptance: {
    steps: [
      "选择本场景，确认 HUD 起始时间已贴近 Day 1 24:00，且小人 Rollover 没有会抢走注意力的紧急需求或工作。",
      "启动模拟，让世界时间自然跨过午夜；不手工改日期、不直调时间纯函数。",
      "观察 HUD 日期、时刻显示和日内进度是否一起进入新的一天。"
    ],
    outcomes: [
      "HUD 会从 Day 1 的日终切到 Day 2 的新日起点附近，而不是把 minuteOfDay 累加成超过 24 小时的绝对值。",
      "跨天后 minuteOfDay 会回到 0 附近，dayNumber 递增 1，日期与时间显示保持同步。",
      "场景内预置了一次很短的 post-hydrate 时间推进，方便 headless 直接覆盖跨午夜归一化。"
    ]
  }
};
