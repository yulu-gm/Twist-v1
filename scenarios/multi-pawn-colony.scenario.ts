import { DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

const [a, b, c] = DEFAULT_WORLD_GRID.defaultSpawnPoints;

/** 三小人默认出生排布：长时间跑模拟仍不饿死，且会出现目标切换事件。 */
export const MULTI_PAWN_COLONY_SCENARIO: ScenarioDefinition = {
  name: "multi-pawn-colony",
  description: "三人殖民地：饱食底线 + 目标变化事件",
  seed: 0x43_4f_4c_4f_4e,
  pawns: [
    { name: "Alex", cell: a! },
    { name: "VC", cell: b! },
    { name: "toastoffee", cell: c! }
  ],
  expectations: [
    {
      label: "无人饱食度低于阈值",
      type: "no-pawn-starved",
      params: { minSatiety: 1 }
    },
    {
      label: "发生过小人目标变更",
      type: "event-occurred",
      params: { eventKind: "pawn-goal-changed" },
      maxTicks: 2000
    }
  ],
  manualAcceptance: {
    steps: [
      "选择本场景，确认三名小人 Alex、VC、toastoffee 分别站在前三格默认出生点。",
      "用 1x～3x 速度运行较长一段时间（单测最多模拟约 2000 tick 量级的决策），观察多人同时觅食、闲逛等是否无卡死。",
      "轮流点击三名小人在名册中的卡片，观察「当前目标 / 动作」是否随时间变化（发生过 goal 切换）。"
    ],
    outcomes: [
      "任意时刻三人的「饱食度」均应保持 ≥ 1（无人饿死；对应 `no-pawn-starved`）。",
      "运行过程中至少出现一次小人目标变化（对应事件 `pawn-goal-changed`；可从 `[AI]` 日志或 debugLabel 变化间接看出）。",
      "无小人永远僵在不可达格、无全员 idle 不推进（若长时间无变化，可提高倍速或多等片刻）。"
    ]
  }
};
