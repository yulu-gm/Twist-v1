import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map/world-grid";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

const PAWN_CELL = DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!;

/** 用一次受控的大帧间隔输入验证世界时间推进被安全截断。 */
export const TIME_FRAME_GAP_GUARD_SCENARIO: ScenarioDefinition = {
  name: "time-frame-gap-guard",
  description: "通过单次超大 post-hydrate tick 验证 frame gap 保护不会造成灾难性时间跳变",
  seed: 0x54_49_4d_45_34,
  pawns: [
    {
      name: "GapGuard",
      cell: PAWN_CELL,
      overrides: {
        satiety: 88,
        energy: 88,
        needs: { hunger: 6, rest: 6, recreation: 6 }
      }
    }
  ],
  timeConfig: {
    startMinuteOfDay: 12 * 60,
    speed: 3
  },
  playerSelectionAfterHydrate: [
    {
      label: "observe-frame-gap",
      toolId: "idle",
      selectionModifier: "replace",
      cellKeys: [coordKey(PAWN_CELL)],
      inputShape: "single-cell",
      semantics: "no-tool"
    }
  ],
  tickScheduleAfterHydrate: [10_000],
  manualAcceptance: {
    steps: [
      "选择本场景，确认起始时间位于白天中段，GapGuard 没有会掩盖时间变化的紧急需求。",
      "通过 headless 或调试入口给场景注入一次异常大的单帧间隔；本场景默认用 hydrate 后的 10_000ms tick 模拟这件事。",
      "观察恢复后的 HUD 时间与场景状态，确认它只前进了一小段安全时间，而不是直接跳过数小时。"
    ],
    outcomes: [
      "即使收到一次很大的 frame gap，世界时间推进也会被上限保护截断；在 3x 速度下也只应前进几分钟量级。",
      "画面与状态保持连续，不应出现因为单帧卡顿恢复而直接跨到夜晚、跨天或把需求瞬间推爆的现象。",
      "本场景关注的是“卡顿恢复后的安全推进”，不是普通的加速运行。"
    ]
  }
};
