/**
 * 游戏场景用的世界与网格初值：在 game 层创建 WorldCore，避免场景直接持有构造细节；
 * 编排用 WorldPort（见 `player/orchestrator-world-bridge`）由场景或应用入口注入组装。
 */

import { createWorldCore, type WorldCore } from "./world-core";
import { DEFAULT_TIME_OF_DAY_CONFIG } from "./time";
import type { TimeOfDayState } from "./time";
import type { SimConfig } from "./behavior";
import {
  blockedKeysFromCells,
  DEFAULT_SCENARIO_INTERACTION_POINTS,
  pickRandomBlockedCells,
  seedInitialTreesAndResources,
  DEFAULT_WORLD_GRID,
  type WorldGridConfig
} from "./map";
import { seedBlockedCellsAsObstacles } from "./world-seed-obstacles";
import { createSeededRng } from "./util/seeded-rng";

const DEFAULT_TERRAIN_DECORATION_SEED = 0xc0ffee42;

export type WorldBootstrapResult = Readonly<{
  worldGrid: WorldGridConfig;
  worldCore: WorldCore;
}>;

export function bootstrapWorldForScene(opts: Readonly<{
  simConfig: SimConfig;
  timeOfDayState: TimeOfDayState;
  /** 树木与食物资源的 Mulberry32 种子；默认固定值以保证可复现。 */
  terrainDecorationSeed?: number;
}>): WorldBootstrapResult {
  const { simConfig, timeOfDayState, terrainDecorationSeed = DEFAULT_TERRAIN_DECORATION_SEED } = opts;
  const excludeSpawn = blockedKeysFromCells(DEFAULT_WORLD_GRID.defaultSpawnPoints);
  /** 与 terrainDecorationSeed 同源派生，避免石格与装饰各用一套随机源。 */
  const stoneLayoutRng = createSeededRng((terrainDecorationSeed ^ 0x5b7a11ed) >>> 0);
  const stoneCellsRandom = pickRandomBlockedCells(
    DEFAULT_WORLD_GRID,
    simConfig.stoneCellCount,
    excludeSpawn,
    stoneLayoutRng
  );
  const worldGrid: WorldGridConfig = {
    ...DEFAULT_WORLD_GRID,
    interactionPoints: DEFAULT_SCENARIO_INTERACTION_POINTS,
    blockedCellKeys: new Set(blockedKeysFromCells(stoneCellsRandom))
  };

  const decorationRng = createSeededRng(terrainDecorationSeed >>> 0);
  const worldCore = seedInitialTreesAndResources(
    seedBlockedCellsAsObstacles(
      createWorldCore({
        grid: worldGrid,
        timeState: { dayNumber: timeOfDayState.dayNumber, minuteOfDay: timeOfDayState.minuteOfDay },
        timeConfig: DEFAULT_TIME_OF_DAY_CONFIG
      }),
      worldGrid.blockedCellKeys ?? new Set()
    ),
    worldGrid,
    decorationRng
  );

  return { worldGrid, worldCore };
}
