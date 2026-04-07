/**
 * 在世界中加入可行走格上的装饰实体（树木、地面食物资源等）；须在 {@link ../world-seed-obstacles!seedBlockedCellsAsObstacles} 之后调用。
 */

import {
  blockedKeysFromCells,
  coordKey,
  isWalkableCell,
  type GridCoord,
  type GridRand,
  type WorldGridConfig
} from "./world-grid";
import { createGameplayGroundFoodDraft } from "../entity/gameplay-ground-food-spawn";
import { createGameplayTreeDraft } from "../entity/gameplay-tree-spawn";
import { spawnWorldEntity, type WorldCore } from "../world-core";
import type { SpawnOutcome } from "../world-internal";
import { initialSeedEntityCounts } from "./world-seed-entities-config";

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

function warnIfInitialSeedEntityFailed(
  kindLabel: string,
  cell: GridCoord,
  outcome: Exclude<SpawnOutcome, Readonly<{ kind: "created" }>>
): void {
  if (process.env.NODE_ENV === "production") return;
  const detail =
    outcome.kind === "conflict"
      ? `conflict with ${outcome.blockingEntityId} at (${outcome.blockingCell.col},${outcome.blockingCell.row})`
      : outcome.kind === "invalid-draft"
        ? outcome.reason
        : `out of bounds at (${outcome.cell.col},${outcome.cell.row})`;
  console.warn(`[world-seed-entities] ${kindLabel} at (${cell.col},${cell.row}) did not spawn: ${detail}`);
}

/**
 * 在已通过障碍播种的世界上追加树木与食物资源。
 * - 树木：8–12 棵，经 {@link createGameplayTreeDraft} 与场景/领域一致。
 * - 资源：3–5 个，经 {@link createGameplayGroundFoodDraft} 与场景/领域一致。
 * 候选格为可行走、非默认出生点；`rng` 建议为 {@link createSeededRng} 以满足同种子可复现。
 */
export function seedInitialTreesAndResources(
  world: WorldCore,
  grid: WorldGridConfig,
  rng: GridRand
): WorldCore {
  const spawnKeys = blockedKeysFromCells(grid.defaultSpawnPoints);
  const candidates = collectFreeCells(grid, spawnKeys);
  const { treeMin, treeRngSpan, resourceMin, resourceRngSpan } = initialSeedEntityCounts;
  const treeCount = treeMin + Math.floor(rng() * treeRngSpan);
  const resourceCount = resourceMin + Math.floor(rng() * resourceRngSpan);
  const total = treeCount + resourceCount;
  const n = Math.min(total, candidates.length);
  const treeN = Math.min(treeCount, n);
  const resourceN = Math.max(0, n - treeN);

  shuffleInPlace(candidates, rng);
  const treeCells = candidates.slice(0, treeN);
  const resourceCells = candidates.slice(treeN, treeN + resourceN);

  let w = world;
  for (const cell of treeCells) {
    const spawned = spawnWorldEntity(w, createGameplayTreeDraft(cell));
    if (spawned.outcome.kind === "created") {
      w = spawned.world;
    } else {
      warnIfInitialSeedEntityFailed("tree", cell, spawned.outcome);
    }
  }
  for (const cell of resourceCells) {
    const spawned = spawnWorldEntity(w, createGameplayGroundFoodDraft(cell));
    if (spawned.outcome.kind === "created") {
      w = spawned.world;
    } else {
      warnIfInitialSeedEntityFailed("ground food", cell, spawned.outcome);
    }
  }
  return w;
}
