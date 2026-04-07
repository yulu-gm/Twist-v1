import { coordKey, DEFAULT_SCENARIO_INTERACTION_POINTS, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

const PAWN_CELL = DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!;

const NEED_ZERO_FLOOR_GRID = {
  ...DEFAULT_WORLD_GRID,
  interactionPoints: DEFAULT_SCENARIO_INTERACTION_POINTS.filter((point) => point.kind === "recreation")
};

/** 无食物兜底时把饱食度压到 0，验证需求数值锁底而不出现负数。 */
export const NEED_ZERO_FLOOR_SCENARIO: ScenarioDefinition = {
  name: "need-zero-floor",
  description: "无食物补给下触发饱食度 0 边界，验证数值锁底与危险态观察",
  seed: 0x4e_45_45_44_30,
  gridConfig: NEED_ZERO_FLOOR_GRID,
  pawns: [
    {
      name: "ZeroFloor",
      cell: PAWN_CELL,
      overrides: {
        satiety: 1,
        energy: 18,
        needs: { hunger: 99, rest: 12, recreation: 0 }
      }
    }
  ],
  timeConfig: { startMinuteOfDay: 12 * 60 },
  playerSelectionAfterHydrate: [
    {
      label: "observe-zero-floor",
      commandId: "idle",
      selectionModifier: "replace",
      cellKeys: [coordKey(PAWN_CELL)],
      inputShape: "single-cell",
      semantics: "no-tool"
    }
  ],
  tickScheduleAfterHydrate: [500],
  expectations: [
    {
      label: "饱食度触底后仍不低于 0",
      type: "no-pawn-starved",
      params: { minSatiety: 0 }
    },
    {
      label: "触底过程中出现过需求变化",
      type: "event-occurred",
      params: { eventKind: "pawn-need-changed" },
      maxTicks: 1
    }
  ],
  manualAcceptance: {
    steps: [
      "选择本场景，确认只有一名名为 ZeroFloor 的小人，初始饱食度接近 0，且地图上没有 food / bed 交互点可兜底恢复。",
      "启动模拟，保持时间自然推进，观察详情面板里的饱食度、饥饿值和当前 goal / action。",
      "继续观察触底瞬间，确认饱食度清空后停在 0，而不是继续跌成负数。"
    ],
    outcomes: [
      "ZeroFloor 的饱食度会很快降到 0，并在 0 处锁住；详情面板不应出现负数。",
      "触底后仍会看到危险态需求反馈，但场景不会因为隐藏的食物或床位把它改写成正常进食/睡眠恢复。",
      "与 headless 入口一致：hydrate 后附带一次短时间推进，用于把场景直接推到 0 边界附近。"
    ]
  }
};
