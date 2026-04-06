import type { ScenarioDefinition } from "../src/headless/scenario-types";

/**
 * 固定 seed 供无头/编排器 RNG 使用。地图上的树木与食物资源由 GameScene
 * {@link bootstrapWorldForScene} 在装载世界时自动播种；`runScenarioHeadless` 不经过该
 * bootstrap，故无 expectations 时本条目主要作场景注册与人工说明。
 */
export const MAP_INITIAL_STATE_SCENARIO: ScenarioDefinition = {
  name: "map-initial-state",
  description: "默认网格上由 bootstrap 自动播种树木与地面食物资源（参见 world-seed-entities）",
  seed: 0x6d61_7000,
  pawns: [],
  expectations: []
};
