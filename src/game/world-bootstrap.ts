/**
 * 游戏场景用的世界与网格初值：在 game 层创建 WorldCore 与网关，避免场景直接持有 WorldCore 构造细节。
 */

import { createWorldCore } from "./world-core";
import { DEFAULT_TIME_OF_DAY_CONFIG } from "./time";
import type { TimeOfDayState } from "./time";
import { WorldCoreWorldPort } from "../player/world-core-world-port";
import type { SimConfig } from "./behavior";
import {
  blockedKeysFromCells,
  pickRandomBlockedCells,
  seedBlockedCellsAsObstacles,
  seedInitialTreesAndResources,
  DEFAULT_WORLD_GRID,
  type WorldGridConfig
} from "./map";
import { createSeededRng } from "./util/seeded-rng";
import type { OrchestratorWorldBridge } from "./orchestrator-world-bridge";

const DEFAULT_TERRAIN_DECORATION_SEED = 0xc0ffee42;

export type WorldBootstrapResult = Readonly<{
  worldGrid: WorldGridConfig;
  worldPort: OrchestratorWorldBridge;
}>;

export function bootstrapWorldForScene(opts: Readonly<{
  simConfig: SimConfig;
  timeOfDayState: TimeOfDayState;
  /** 树木与食物资源的 Mulberry32 种子；默认固定值以保证可复现。 */
  terrainDecorationSeed?: number;
}>): WorldBootstrapResult {
  const { simConfig, timeOfDayState, terrainDecorationSeed = DEFAULT_TERRAIN_DECORATION_SEED } = opts;
  const excludeSpawn = blockedKeysFromCells(DEFAULT_WORLD_GRID.defaultSpawnPoints);
  const stoneCellsRandom = pickRandomBlockedCells(
    DEFAULT_WORLD_GRID,
    simConfig.stoneCellCount,
    excludeSpawn,
    () => Math.random()
  );
  const worldGrid: WorldGridConfig = {
    ...DEFAULT_WORLD_GRID,
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

  const worldPort: OrchestratorWorldBridge = new WorldCoreWorldPort(worldCore);
  return { worldGrid, worldPort };
}
