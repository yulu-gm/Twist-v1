/**
 * 在世界中加入可行走格上的装饰实体（树木、地面食物资源等），与 {@link seedBlockedCellsAsObstacles} 顺序衔接。
 */

import {
  blockedKeysFromCells,
  coordKey,
  isWalkableCell,
  type GridCoord,
  type GridRand,
  type WorldGridConfig
} from "./world-grid";
import { spawnWorldEntity, type WorldCore } from "../world-core";

function collectFreeCells(grid: WorldGridConfig, excludeSpawn: ReadonlySet<string>): GridCoord[] {
  const out: GridCoord[] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.columns; col += 1) {
      const cell: GridCoord = { col, row };
      const key = coordKey(cell);
      if (!isWalkableCell(grid, cell)) continue;
      if (excludeSpawn.has(key)) continue;
      out.push(cell);
    }
  }
  return out;
}

function shuffleInPlace<T>(items: T[], rng: GridRand): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = items[i]!;
    const b = items[j]!;
    items[i] = b;
    items[j] = a;
  }
}

/**
 * 在已通过障碍播种的世界上追加树木与食物资源。
 * - 树木：8–12 棵，`occupiedCells` 为空，不写入占格；`loggingMarked: false`。
 * - 资源：3–5 个，`materialKind: food`，`containerKind: ground`，`pickupAllowed: false`。
 * 候选格为可行走、非默认出生点；`rng` 建议为 {@link createSeededRng} 以满足同种子可复现。
 */
export function seedInitialTreesAndResources(
  world: WorldCore,
  grid: WorldGridConfig,
  rng: GridRand
): WorldCore {
  const spawnKeys = blockedKeysFromCells(grid.defaultSpawnPoints);
  const candidates = collectFreeCells(grid, spawnKeys);
  const treeCount = 8 + Math.floor(rng() * 5);
  const resourceCount = 3 + Math.floor(rng() * 3);
  const total = treeCount + resourceCount;
  const n = Math.min(total, candidates.length);
  const treeN = Math.min(treeCount, n);
  const resourceN = Math.max(0, n - treeN);

  shuffleInPlace(candidates, rng);
  const treeCells = candidates.slice(0, treeN);
  const resourceCells = candidates.slice(treeN, treeN + resourceN);

  let w = world;
  for (const cell of treeCells) {
    const spawned = spawnWorldEntity(w, {
      kind: "tree",
      cell,
      occupiedCells: [],
      loggingMarked: false
    });
    if (spawned.outcome.kind === "created") {
      w = spawned.world;
    }
  }
  for (const cell of resourceCells) {
    const spawned = spawnWorldEntity(w, {
      kind: "resource",
      cell,
      occupiedCells: [cell],
      materialKind: "food",
      containerKind: "ground",
      pickupAllowed: false
    });
    if (spawned.outcome.kind === "created") {
      w = spawned.world;
    }
  }
  return w;
}
