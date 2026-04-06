import { DEFAULT_WORLD_GRID } from "../src/game/map";
import type { ScenarioDefinition } from "../src/headless/scenario-types";

/** 固定 seed、单小人、无蓝图；无头单测在此场景装载后提交 `zone_create`。 */
export const ZONE_CREATE_SCENARIO: ScenarioDefinition = {
  name: "zone-create",
  description: "领域 zone_create / 存储区实体（不占 occupancy）验收用基线场景",
  seed: 0x7a6f_6e63_7241, // 'z','o','n','c','r','a'-ish
  pawns: [{ name: "Solo", cell: DEFAULT_WORLD_GRID.defaultSpawnPoints[0]! }],
  expectations: []
};
