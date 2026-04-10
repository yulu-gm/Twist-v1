/**
 * @file item.queries.ts
 * @description 物品查询函数，提供按地图获取物品列表、按ID查找、按坐标筛选及放置可行性判断
 * @dependencies world/game-map, world/def-database, world/zone-manager, core/types, item.types
 * @part-of features/item 物品功能模块
 */

import { ObjectKind, ZoneType, cellKey, parseKey } from '../../core/types';
import type { CellCoord, CellCoordKey, DefId } from '../../core/types';
import { createDefaultStockpileZoneConfig } from '../../world/zone-manager';
import type { DefDatabase } from '../../world/def-database';
import type { GameMap } from '../../world/game-map';
import type { Item } from './item.types';
import type {
  ItemPlacementSearchScope,
  ItemPlacementSelectionPreference,
} from './item.types';

const FALLBACK_ITEM_TAGS = new Set(['haulable', 'resource']);
const FALLBACK_MAX_STACK = 100;

/**
 * 获取地图上的所有物品
 * @param map - 游戏地图对象
 * @returns 该地图上所有物品的数组
 */
export function getAllItems(map: GameMap): Item[] {
  return map.objects.allOfKind(ObjectKind.Item);
}

/**
 * 按ID查找物品
 * @param map - 游戏地图对象
 * @param id - 物品的对象ID
 * @returns 找到的物品对象，未找到则返回 undefined
 */
export function getItemById(map: GameMap, id: string): Item | undefined {
  return map.objects.getAs(id, ObjectKind.Item);
}

/**
 * 获取指定坐标上的所有物品
 * @param map - 游戏地图对象
 * @param x - 格子X坐标
 * @param y - 格子Y坐标
 * @returns 该坐标上的物品数组
 */
export function getItemsAt(map: GameMap, x: number, y: number): Item[] {
  return getItemsAtCell(map, { x, y });
}

/**
 * 获取指定格子上的所有物品
 * @param map - 游戏地图对象
 * @param cell - 格子坐标
 * @returns 该格子上的全部物品
 */
export function getItemsAtCell(map: GameMap, cell: CellCoord): Item[] {
  const ids = map.spatial.getAt(cell);
  const items: Item[] = [];

  for (const id of ids) {
    const item = map.objects.getAs(id, ObjectKind.Item);
    if (item) {
      items.push(item);
    }
  }

  items.sort((a, b) => a.id.localeCompare(b.id));
  return items;
}

/**
 * 判断某格是否只包含单一物品类型，且该类型与目标 defId 一致
 * 这是旧语义的兼容导出：它只关心“同格是否混放不同物品类型”，不检查容量。
 * @param map - 游戏地图对象
 * @param cell - 格子坐标
 * @param defId - 目标物品定义 ID
 * @returns 空格或只含相同 defId 时返回 true
 */
export function isCellCompatibleForItemDef(map: GameMap, cell: CellCoord, defId: DefId): boolean {
  const items = getItemsAtCell(map, cell);
  return items.every(item => item.defId === defId);
}

/**
 * 判断某格是否可以接收指定物品。
 * 兼容规则包括：地形可通行、空间索引不被不可通行对象占用、若在 stockpile 中则满足该区域配置，
 * 且该格为空或已有同类未满堆。
 */
export function canPlaceItemAtCell(
  map: GameMap,
  defs: DefDatabase,
  cell: CellCoord,
  defId: DefId,
  searchScope: ItemPlacementSearchScope,
): boolean {
  if (!map.pathGrid.isPassable(cell.x, cell.y)) return false;
  if (!map.spatial.isPassable(cell)) return false;

  const itemTags = getResolvedItemTags(defs, defId);
  const zone = map.zones.getZoneAt(cellKey(cell));

  if (searchScope === 'stockpile-only') {
    if (!zone || zone.zoneType !== ZoneType.Stockpile) return false;
    if (!isItemAcceptedByStockpile(zone, defId, itemTags)) return false;
  } else if (zone?.zoneType === ZoneType.Stockpile) {
    if (!isItemAcceptedByStockpile(zone, defId, itemTags)) return false;
  }

  const items = getItemsAtCell(map, cell);
  if (items.length === 0) return true;
  if (items.some(item => item.defId !== defId)) return false;

  const maxStack = getResolvedMaxStack(defs, defId, items);
  return items.some(item => item.stackCount < maxStack);
}

export interface FindNearestAcceptingCellOptions {
  excludedCells?: Set<CellCoordKey>;
  selectionPreference?: ItemPlacementSelectionPreference;
}

/**
 * 在给定范围内寻找最近可接收指定物品的格子。
 * stockpile-only 只搜索 stockpile 格；nearest-compatible 则可搜索全图，但仍会尊重 stockpile 的 allowedDefIds。
 */
export function findNearestAcceptingCell(
  map: GameMap,
  defs: DefDatabase,
  origin: CellCoord,
  defId: DefId,
  searchScope: ItemPlacementSearchScope,
  options?: FindNearestAcceptingCellOptions,
): CellCoord | null {
  const excludedCells = options?.excludedCells;
  const selectionPreference = options?.selectionPreference ?? 'nearest';
  let bestCell: CellCoord | null = null;
  let bestDistance = Infinity;
  let bestExistingStackCell: CellCoord | null = null;
  let bestExistingStackDistance = Infinity;

  const considerCell = (cell: CellCoord): void => {
    if (excludedCells?.has(cellKey(cell))) return;
    if (!canPlaceItemAtCell(map, defs, cell, defId, searchScope)) return;

    const distance = Math.abs(origin.x - cell.x) + Math.abs(origin.y - cell.y);
    if (isBetterCandidate(cell, distance, bestCell, bestDistance)) {
      bestCell = { x: cell.x, y: cell.y };
      bestDistance = distance;
    }

    if (
      selectionPreference === 'prefer-existing-stacks'
      && hasReusableStackAtCell(map, defs, cell, defId)
      && isBetterCandidate(cell, distance, bestExistingStackCell, bestExistingStackDistance)
    ) {
      bestExistingStackCell = { x: cell.x, y: cell.y };
      bestExistingStackDistance = distance;
    }
  };

  if (searchScope === 'stockpile-only') {
    for (const zone of map.zones.getAll()) {
      if (zone.zoneType !== ZoneType.Stockpile) continue;
      for (const key of zone.cells) {
        considerCell(parseKey(key));
      }
    }
  } else {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        considerCell({ x, y });
      }
    }
  }

  if (selectionPreference === 'prefer-existing-stacks' && bestExistingStackCell) {
    return bestExistingStackCell;
  }

  return bestCell;
}

function isItemAcceptedByStockpile(zone: { config: { stockpile?: { allowAllHaulable: boolean; allowedDefIds: Set<DefId> } } }, defId: DefId, itemTags: Set<string>): boolean {
  const stockpile = zone.config.stockpile ?? createDefaultStockpileZoneConfig();
  if (stockpile.allowAllHaulable) {
    return itemTags.has('haulable');
  }
  return stockpile.allowedDefIds.has(defId);
}

function getResolvedItemTags(defs: DefDatabase, defId: DefId): Set<string> {
  const itemDef = defs.items.get(defId);
  return itemDef ? new Set(itemDef.tags) : new Set(FALLBACK_ITEM_TAGS);
}

function getResolvedMaxStack(defs: DefDatabase, defId: DefId, itemsAtCell: Item[]): number {
  const itemDef = defs.items.get(defId);
  const fallback = itemsAtCell[0]?.maxStack ?? FALLBACK_MAX_STACK;
  return Math.max(1, itemDef?.maxStack ?? fallback);
}

function hasReusableStackAtCell(
  map: GameMap,
  defs: DefDatabase,
  cell: CellCoord,
  defId: DefId,
): boolean {
  const items = getItemsAtCell(map, cell);
  if (items.length === 0) return false;
  if (items.some(item => item.defId !== defId)) return false;

  const maxStack = getResolvedMaxStack(defs, defId, items);
  return items.some(item => item.stackCount < maxStack);
}

function isBetterCandidate(
  cell: CellCoord,
  distance: number,
  bestCell: CellCoord | null,
  bestDistance: number,
): boolean {
  if (!bestCell) return true;
  if (distance < bestDistance) return true;
  if (distance > bestDistance) return false;
  return cell.y < bestCell.y || (cell.y === bestCell.y && cell.x < bestCell.x);
}
