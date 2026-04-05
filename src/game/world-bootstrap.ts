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
  parseCoordKey,
  pickRandomBlockedCells,
  seedBlockedCellsAsObstacles,
  DEFAULT_WORLD_GRID,
  type WorldGridConfig
} from "./map";
import type { PlayerAcceptanceScenario } from "../data/player-acceptance-scenarios";
import type { OrchestratorWorldBridge } from "./orchestrator-world-bridge";

export type WorldBootstrapResult = Readonly<{
  worldGrid: WorldGridConfig;
  worldPort: OrchestratorWorldBridge;
}>;

export function bootstrapWorldForScene(opts: Readonly<{
  scenario: PlayerAcceptanceScenario | undefined;
  simConfig: SimConfig;
  timeOfDayState: TimeOfDayState;
}>): WorldBootstrapResult {
  const { scenario, simConfig, timeOfDayState } = opts;
  const excludeSpawn = blockedKeysFromCells(DEFAULT_WORLD_GRID.defaultSpawnPoints);
  const forcedBlockedKeys = scenario?.forcedBlockedCellKeys ?? [];
  const stoneCellsRandom = pickRandomBlockedCells(
    DEFAULT_WORLD_GRID,
    simConfig.stoneCellCount,
    excludeSpawn,
    () => Math.random()
  );
  const stoneCells = [...stoneCellsRandom];
  for (const fk of forcedBlockedKeys) {
    const p = parseCoordKey(fk);
    if (!p) continue;
    if (!stoneCells.some((s) => s.col === p.col && s.row === p.row)) {
      stoneCells.push(p);
    }
  }
  const worldGrid: WorldGridConfig = {
    ...DEFAULT_WORLD_GRID,
    blockedCellKeys: new Set([...blockedKeysFromCells(stoneCells), ...forcedBlockedKeys])
  };

  const worldCore = seedBlockedCellsAsObstacles(
    createWorldCore({
      grid: worldGrid,
      timeState: { dayNumber: timeOfDayState.dayNumber, minuteOfDay: timeOfDayState.minuteOfDay },
      timeConfig: DEFAULT_TIME_OF_DAY_CONFIG
    }),
    worldGrid.blockedCellKeys ?? new Set()
  );

  const worldPort: OrchestratorWorldBridge = new WorldCoreWorldPort(worldCore);
  return { worldGrid, worldPort };
}
