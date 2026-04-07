/**
 * 场景定义汇总入口：各场景模块 export 具体 {@link ScenarioDefinition} 后在此 import 并加入 {@link ALL_SCENARIOS}。
 * T-10 起填入真实场景；保持静态数组以便浏览器端打包与 GameScene 场景面板枚举。
 */

import type { ScenarioDefinition } from "../src/headless/scenario-types";
import { BEHAVIOR_001_WANDER_SCENARIO } from "./behavior-001-wander.scenario";
import { BEHAVIOR_004_NO_RESOURCE_DOWNGRADE_SCENARIO } from "./behavior-004-no-resource-downgrade.scenario";
import { BED_AUTO_ASSIGN_SCENARIO } from "./bed-auto-assign.scenario";
import { BED_OVERFLOW_UNASSIGNED_SCENARIO } from "./bed-overflow-unassigned.scenario";
import { BUILD_BED_FLOW_SCENARIO } from "./build-bed-flow.scenario";
import { BUILD_INVALID_PLACEMENT_SCENARIO } from "./build-invalid-placement.scenario";
import { BUILD_WALL_FLOW_SCENARIO } from "./build-wall-flow.scenario";
import { CHOP_HAUL_FULL_CHAIN_SCENARIO } from "./chop-haul-full-chain.scenario";
import { CHOP_TREE_COMMAND_SCENARIO } from "./chop-tree-command.scenario";
import { CHOP_TREE_FULL_FLOW_SCENARIO } from "./chop-tree-full-flow.scenario";
import { ENTITY_RESOURCE_CONFLICT_SCENARIO } from "./entity-resource-conflict.scenario";
import { HAUL_MARK_PICKUP_SCENARIO } from "./haul-mark-pickup.scenario";
import { INTERACTION_NO_TOOL_SCENARIO } from "./interaction-no-tool.scenario";
import { MAP_BLOCKED_PLACEMENT_SCENARIO } from "./map-blocked-placement.scenario";
import { MAP_INITIAL_STATE_SCENARIO } from "./map-initial-state.scenario";
import { MAP_OUT_OF_BOUNDS_SELECTION_SCENARIO } from "./map-out-of-bounds-selection.scenario";
import { MULTI_PAWN_COLONY_SCENARIO } from "./multi-pawn-colony.scenario";
import { NEED_INTERRUPT_DURING_WORK_SCENARIO } from "./need-interrupt-during-work.scenario";
import { NEED_ZERO_FLOOR_SCENARIO } from "./need-zero-floor.scenario";
import { NIGHT_FORCES_SLEEP_SCENARIO } from "./night-forces-sleep.scenario";
import { OBSTACLE_AVOIDANCE_EAT_SCENARIO } from "./obstacle-avoidance-eat.scenario";
import { PAWN_EATS_WHEN_HUNGRY_SCENARIO } from "./pawn-eats-when-hungry.scenario";
import { PAWN_SLEEPS_WHEN_TIRED_SCENARIO } from "./pawn-sleeps-when-tired.scenario";
import { STORY_1_DAY_ONE_SCENARIO } from "./story-1-day-one.scenario";
import { TIME_DAY_ROLLOVER_SCENARIO } from "./time-day-rollover.scenario";
import { TIME_FRAME_GAP_GUARD_SCENARIO } from "./time-frame-gap-guard.scenario";
import { TIME_PAUSE_FREEZE_SCENARIO } from "./time-pause-freeze.scenario";
import { UI_LAYER_CLARITY_SCENARIO } from "./ui-layer-clarity.scenario";
import { ZONE_CREATE_SCENARIO } from "./zone-create.scenario";

export {
  BEHAVIOR_001_WANDER_SCENARIO,
  BEHAVIOR_004_NO_RESOURCE_DOWNGRADE_SCENARIO,
  BED_AUTO_ASSIGN_SCENARIO,
  BED_OVERFLOW_UNASSIGNED_SCENARIO,
  BUILD_BED_FLOW_SCENARIO,
  BUILD_INVALID_PLACEMENT_SCENARIO,
  BUILD_WALL_FLOW_SCENARIO,
  CHOP_HAUL_FULL_CHAIN_SCENARIO,
  CHOP_TREE_COMMAND_SCENARIO,
  CHOP_TREE_FULL_FLOW_SCENARIO,
  ENTITY_RESOURCE_CONFLICT_SCENARIO,
  HAUL_MARK_PICKUP_SCENARIO,
  INTERACTION_NO_TOOL_SCENARIO,
  MAP_BLOCKED_PLACEMENT_SCENARIO,
  MAP_INITIAL_STATE_SCENARIO,
  MAP_OUT_OF_BOUNDS_SELECTION_SCENARIO,
  MULTI_PAWN_COLONY_SCENARIO,
  NEED_INTERRUPT_DURING_WORK_SCENARIO,
  NEED_ZERO_FLOOR_SCENARIO,
  NIGHT_FORCES_SLEEP_SCENARIO,
  OBSTACLE_AVOIDANCE_EAT_SCENARIO,
  PAWN_EATS_WHEN_HUNGRY_SCENARIO,
  PAWN_SLEEPS_WHEN_TIRED_SCENARIO,
  STORY_1_DAY_ONE_SCENARIO,
  TIME_DAY_ROLLOVER_SCENARIO,
  TIME_FRAME_GAP_GUARD_SCENARIO,
  TIME_PAUSE_FREEZE_SCENARIO,
  UI_LAYER_CLARITY_SCENARIO,
  ZONE_CREATE_SCENARIO
};

export const ALL_SCENARIOS: ScenarioDefinition[] = [
  MAP_INITIAL_STATE_SCENARIO,
  PAWN_EATS_WHEN_HUNGRY_SCENARIO,
  OBSTACLE_AVOIDANCE_EAT_SCENARIO,
  PAWN_SLEEPS_WHEN_TIRED_SCENARIO,
  BED_AUTO_ASSIGN_SCENARIO,
  BUILD_BED_FLOW_SCENARIO,
  BUILD_WALL_FLOW_SCENARIO,
  CHOP_HAUL_FULL_CHAIN_SCENARIO,
  CHOP_TREE_COMMAND_SCENARIO,
  CHOP_TREE_FULL_FLOW_SCENARIO,
  HAUL_MARK_PICKUP_SCENARIO,
  MULTI_PAWN_COLONY_SCENARIO,
  NEED_INTERRUPT_DURING_WORK_SCENARIO,
  NIGHT_FORCES_SLEEP_SCENARIO,
  ZONE_CREATE_SCENARIO,
  STORY_1_DAY_ONE_SCENARIO,
  NEED_ZERO_FLOOR_SCENARIO,
  TIME_DAY_ROLLOVER_SCENARIO,
  TIME_PAUSE_FREEZE_SCENARIO,
  TIME_FRAME_GAP_GUARD_SCENARIO,
  BEHAVIOR_001_WANDER_SCENARIO,
  BEHAVIOR_004_NO_RESOURCE_DOWNGRADE_SCENARIO,
  ENTITY_RESOURCE_CONFLICT_SCENARIO,
  MAP_BLOCKED_PLACEMENT_SCENARIO,
  MAP_OUT_OF_BOUNDS_SELECTION_SCENARIO,
  BUILD_INVALID_PLACEMENT_SCENARIO,
  BED_OVERFLOW_UNASSIGNED_SCENARIO,
  INTERACTION_NO_TOOL_SCENARIO,
  UI_LAYER_CLARITY_SCENARIO
];

export function getAllScenarios(): readonly ScenarioDefinition[] {
  return ALL_SCENARIOS;
}
