import { coordKey, DEFAULT_SCENARIO_INTERACTION_POINTS, DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

const PAWN_CELL = DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!;

const NO_BED_GRID = {
  ...DEFAULT_WORLD_GRID,
  interactionPoints: DEFAULT_SCENARIO_INTERACTION_POINTS.filter((point) => point.kind !== "bed")
};

/** 夜间高疲劳但无床可用时，不应伪装成正常 sleep，而应降级为 wander / 等待类行为。 */
export const BEHAVIOR_004_NO_RESOURCE_DOWNGRADE_SCENARIO: ScenarioDefinition = {
  name: "behavior-004-no-resource-downgrade",
  description: "无床铺资源时的疲劳降级：不能正常 sleep，只能进入可见降级行为",
  seed: 0x42_48_41_56_34,
  gridConfig: NO_BED_GRID,
  pawns: [
    {
      name: "NoBed",
      cell: PAWN_CELL,
      overrides: {
        satiety: 92,
        energy: 8,
        needs: { hunger: 0, rest: 92, recreation: 0 }
      }
    }
  ],
  timeConfig: { startMinuteOfDay: 23 * 60 + 30 },
  playerSelectionAfterHydrate: [
    {
      label: "observe-no-resource-downgrade",
      commandId: "idle",
      selectionModifier: "replace",
      cellKeys: [coordKey(PAWN_CELL)],
      inputShape: "single-cell",
      semantics: "no-tool"
    }
  ],
  expectations: [
    {
      label: "无床时转入降级 wander 目标",
      type: "pawn-reaches-goal",
      params: { goalKind: "wander", pawnId: "pawn-0" },
      maxTicks: 200
    },
    {
      label: "降级行为带来可见位移",
      type: "event-occurred",
      params: { eventKind: "pawn-moved" },
      maxTicks: 500
    }
  ],
  manualAcceptance: {
    steps: [
      "选择本场景，确认当前是深夜、NoBed 已高度疲劳，但地图上没有任何 bed 交互点可供分配。",
      "启动模拟，观察系统尝试为疲劳小人寻找睡眠去向后的结果。",
      "继续推进，重点查看 NoBed 的当前 goal / action、移动方向和 HUD 提示，确认它表现为降级行为而不是正常 sleep。"
    ],
    outcomes: [
      "NoBed 不应拿到有效的 sleep 目标，也不应朝 (9,7)/(10,7) 之类默认床位坐标移动，因为这些资源在本场景已被移除。",
      "场景应表现为 wander / 徘徊 / 等待这类可见降级行为，明确区分于正常入睡恢复。",
      "本场景只验证“无资源时降级”，不把它写成 night-forces-sleep 那条正常睡眠链路。"
    ]
  }
};
