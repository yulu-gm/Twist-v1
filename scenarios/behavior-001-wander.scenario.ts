import { coordKey, DEFAULT_WORLD_GRID } from "../src/game/map/world-grid";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

const PAWN_CELL = DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!;

/** 无工作、无紧迫需求时，小人应进入 wander 并产生可见移动。 */
export const BEHAVIOR_001_WANDER_SCENARIO: ScenarioDefinition = {
  name: "behavior-001-wander",
  description: "单人空闲场景：没有工作与紧急需求时自然进入 wander",
  seed: 0x42_48_41_56_31,
  pawns: [
    {
      name: "Wanderer",
      cell: PAWN_CELL,
      overrides: {
        satiety: 100,
        energy: 100,
        needs: { hunger: 0, rest: 0, recreation: 0 }
      }
    }
  ],
  timeConfig: { startMinuteOfDay: 10 * 60 },
  playerSelectionAfterHydrate: [
    {
      label: "observe-wander",
      commandId: "idle",
      selectionModifier: "replace",
      cellKeys: [coordKey(PAWN_CELL)],
      inputShape: "single-cell",
      semantics: "no-tool"
    }
  ],
  expectations: [
    {
      label: "小人进入散步目标",
      type: "pawn-reaches-goal",
      params: { goalKind: "wander", pawnId: "pawn-0" },
      maxTicks: 200
    },
    {
      label: "小人发生至少一次实际移动",
      type: "event-occurred",
      params: { eventKind: "pawn-moved" },
      maxTicks: 500
    }
  ],
  manualAcceptance: {
    steps: [
      "选择本场景，确认只有 Wanderer 一人，地图上没有任何预置工单，且他的饥饿/疲劳/娱乐需求都不紧迫。",
      "启动模拟，观察小人是否从原地空闲转入闲逛，并在附近可达格之间移动。",
      "查看详情面板或日志中的 goal / action 文案，确认状态变化来自场景自然推进而不是手工注入。"
    ],
    outcomes: [
      "Wanderer 会进入 wander / 闲逛语义，而不是被伪装成工作、进食或睡眠目标。",
      "地图上能看到至少一次真实位移，说明这是可见散步，不是只改了内部 goal 字段。",
      "本场景只覆盖“空闲散步”，不混入接单、需求打断或资源不可用的语义。"
    ]
  }
};
