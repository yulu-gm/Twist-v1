/**
 * @file item.placement.ts
 * @description 物品落地/堆叠统一入口，供 Drop、cleanup、产出和退款逻辑复用
 * @dependencies core/types, world/game-map, world/def-database, item.factory, item.queries, item.types
 * @part-of features/item 物品功能模块
 */

import { cellKey, type CellCoord, type CellCoordKey, type DefId } from '../../core/types';
import type { DefDatabase } from '../../world/def-database';
import type { GameMap } from '../../world/game-map';
import { createItemRaw } from './item.factory';
import {
  canPlaceItemAtCell,
  findNearestAcceptingCell,
  getItemsAtCell,
} from './item.queries';
import type {
  PlaceItemOnMapParams,
  PlaceItemOnMapResult,
} from './item.types';

const FALLBACK_ITEM_TAGS = new Set(['haulable', 'resource']);
const FALLBACK_MAX_STACK = 100;

/**
 * 将物品放置到地图上。
 * 行为规则：
 * - 同 defId 优先并入未满堆。
 * - 正常路径不混格；若 noCapacityPolicy=force-overflow，则在 preferredCell 允许紧急落地。
 */
export function placeItemOnMap(params: PlaceItemOnMapParams): PlaceItemOnMapResult {
  const count = Math.max(0, Math.floor(params.count));
  if (count === 0) {
    return {
      placedCount: 0,
      remainingCount: 0,
      usedFallback: false,
      usedCells: [],
      success: true,
    };
  }

  const resolved = resolvePlacementDef(params.defs, params.defId);
  const preferredCell = { x: params.preferredCell.x, y: params.preferredCell.y };
  const usedCellKeys = new Set<CellCoordKey>();
  const usedCells: CellCoord[] = [];

  let remaining = count;
  let placedCount = 0;
  let usedFallback = false;

  const excludedCells = new Set<CellCoordKey>();

  while (remaining > 0) {
    const candidate = findNearestAcceptingCell(
      params.map,
      params.defs,
      preferredCell,
      params.defId,
      params.searchScope,
      {
        excludedCells,
        selectionPreference: params.selectionPreference,
      },
    );

    if (!candidate) {
      break;
    }

    const placedHere = placeCountAtCell(params.map, params.defs, candidate, params.defId, remaining, resolved.maxStack, resolved.tags);
    if (placedHere <= 0) {
      excludedCells.add(cellKey(candidate));
      continue;
    }

    placedCount += placedHere;
    remaining -= placedHere;
    excludedCells.add(cellKey(candidate));
    recordUsedCell(candidate, usedCellKeys, usedCells);

    if (candidate.x !== preferredCell.x || candidate.y !== preferredCell.y) {
      usedFallback = true;
    }
  }

  if (remaining > 0 && params.noCapacityPolicy === 'force-overflow') {
    // 紧急兜底：保证物品不丢失，必要时在 preferredCell 上强制生成剩余堆。
    // 这是刻意破坏常规落地约束的最后手段，供 cleanup / 退款等“不能丢失物品”的路径使用。
    console.warn(
      '[item] force-overflow placement used for',
      params.defId,
      'remaining=',
      remaining,
      'preferredCell=',
      preferredCell,
    );

    const overflowPlaced = forcePlaceRemainingAtCell(
      params.map,
      params.defs,
      preferredCell,
      params.defId,
      remaining,
      resolved.maxStack,
      resolved.tags,
    );
    if (overflowPlaced > 0) {
      placedCount += overflowPlaced;
      remaining -= overflowPlaced;
      recordUsedCell(preferredCell, usedCellKeys, usedCells);
      usedFallback = true;
    }
  }

  return {
    placedCount,
    remainingCount: remaining,
    usedFallback,
    usedCells,
    success: remaining === 0,
  };
}

function placeCountAtCell(
  map: GameMap,
  defs: DefDatabase,
  cell: CellCoord,
  defId: DefId,
  remaining: number,
  maxStack: number,
  tags: Set<string>,
): number {
  if (!canPlaceItemAtCell(map, defs, cell, defId, 'nearest-compatible')) {
    return 0;
  }

  const items = getItemsAtCell(map, cell);
  const sameDefItems = items.filter(item => item.defId === defId);
  if (sameDefItems.length === 0 && items.length > 0) {
    return 0;
  }

  let placed = 0;
  const reusableStacks = sameDefItems
    .filter(item => item.stackCount < maxStack)
    .sort((a, b) => (a.stackCount - b.stackCount) || a.id.localeCompare(b.id));

  for (const stack of reusableStacks) {
    if (remaining <= 0) break;
    const space = Math.max(0, maxStack - stack.stackCount);
    if (space <= 0) continue;

    const add = Math.min(remaining, space);
    stack.maxStack = maxStack;
    stack.stackCount += add;
    remaining -= add;
    placed += add;
  }

  if (remaining <= 0) {
    return placed;
  }

  if (items.length === 0) {
    const add = Math.min(remaining, maxStack);
    map.objects.add(createItemRaw({
      defId,
      cell,
      mapId: map.id,
      stackCount: add,
      tags: new Set(tags),
      maxStack,
      defs,
    }));
    placed += add;
  }

  return placed;
}

function forcePlaceRemainingAtCell(
  map: GameMap,
  defs: DefDatabase,
  cell: CellCoord,
  defId: DefId,
  remaining: number,
  maxStack: number,
  tags: Set<string>,
): number {
  const items = getItemsAtCell(map, cell);
  const sameDefItems = items.filter(item => item.defId === defId);

  let placed = 0;
  let pending = remaining;

  for (const stack of sameDefItems.sort((a, b) => (a.stackCount - b.stackCount) || a.id.localeCompare(b.id))) {
    if (pending <= 0) break;
    const space = Math.max(0, maxStack - stack.stackCount);
    if (space <= 0) continue;

    const add = Math.min(pending, space);
    stack.maxStack = maxStack;
    stack.stackCount += add;
    pending -= add;
    placed += add;
  }

  while (pending > 0) {
    const add = Math.min(pending, maxStack);
    map.objects.add(createItemRaw({
      defId,
      cell,
      mapId: map.id,
      stackCount: add,
      tags: new Set(tags),
      maxStack,
      defs,
    }));
    pending -= add;
    placed += add;
  }

  return placed;
}

function resolvePlacementDef(defs: DefDatabase, defId: DefId): { tags: Set<string>; maxStack: number } {
  const def = defs.items.get(defId);
  return {
    tags: def ? new Set(def.tags) : new Set(FALLBACK_ITEM_TAGS),
    maxStack: Math.max(1, def?.maxStack ?? FALLBACK_MAX_STACK),
  };
}

function recordUsedCell(cell: CellCoord, usedCellKeys: Set<CellCoordKey>, usedCells: CellCoord[]): void {
  const key = cellKey(cell);
  if (usedCellKeys.has(key)) return;
  usedCellKeys.add(key);
  usedCells.push({ x: cell.x, y: cell.y });
}
