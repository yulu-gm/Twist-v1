/**
 * 场景定义汇总入口：各场景模块 export 具体 {@link ScenarioDefinition} 后在此 import 并加入 {@link ALL_SCENARIOS}。
 * T-10 起填入真实场景；保持静态数组以便浏览器端打包与 {@link listAvailableScenarios} 枚举。
 */

import type { ScenarioDefinition } from "../src/headless/scenario-types";
import { BED_AUTO_ASSIGN_SCENARIO } from "./bed-auto-assign.scenario";
import { BUILD_BED_FLOW_SCENARIO } from "./build-bed-flow.scenario";
import { BUILD_WALL_FLOW_SCENARIO } from "./build-wall-flow.scenario";
import { CHOP_HAUL_FULL_CHAIN_SCENARIO } from "./chop-haul-full-chain.scenario";
import { CHOP_TREE_COMMAND_SCENARIO } from "./chop-tree-command.scenario";
import { CHOP_TREE_FULL_FLOW_SCENARIO } from "./chop-tree-full-flow.scenario";
import { HAUL_MARK_PICKUP_SCENARIO } from "./haul-mark-pickup.scenario";
import { MAP_INITIAL_STATE_SCENARIO } from "./map-initial-state.scenario";
import { MULTI_PAWN_COLONY_SCENARIO } from "./multi-pawn-colony.scenario";
import { NEED_INTERRUPT_DURING_WORK_SCENARIO } from "./need-interrupt-during-work.scenario";
import { NIGHT_FORCES_SLEEP_SCENARIO } from "./night-forces-sleep.scenario";
import { PAWN_EATS_WHEN_HUNGRY_SCENARIO } from "./pawn-eats-when-hungry.scenario";
import { PAWN_SLEEPS_WHEN_TIRED_SCENARIO } from "./pawn-sleeps-when-tired.scenario";
import { ZONE_CREATE_SCENARIO } from "./zone-create.scenario";
import { STORY_1_DAY_ONE_SCENARIO } from "./story-1-day-one.scenario";

export {
  BED_AUTO_ASSIGN_SCENARIO,
  BUILD_BED_FLOW_SCENARIO,
  BUILD_WALL_FLOW_SCENARIO,
  CHOP_HAUL_FULL_CHAIN_SCENARIO,
  CHOP_TREE_COMMAND_SCENARIO,
  CHOP_TREE_FULL_FLOW_SCENARIO,
  HAUL_MARK_PICKUP_SCENARIO,
  MAP_INITIAL_STATE_SCENARIO,
  MULTI_PAWN_COLONY_SCENARIO,
  NEED_INTERRUPT_DURING_WORK_SCENARIO,
  NIGHT_FORCES_SLEEP_SCENARIO,
  PAWN_EATS_WHEN_HUNGRY_SCENARIO,
  PAWN_SLEEPS_WHEN_TIRED_SCENARIO,
  ZONE_CREATE_SCENARIO,
  STORY_1_DAY_ONE_SCENARIO
};

export const ALL_SCENARIOS: ScenarioDefinition[] = [
  MAP_INITIAL_STATE_SCENARIO,
  PAWN_EATS_WHEN_HUNGRY_SCENARIO,
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
  STORY_1_DAY_ONE_SCENARIO
];

export function getAllScenarios(): readonly ScenarioDefinition[] {
  return ALL_SCENARIOS;
}
