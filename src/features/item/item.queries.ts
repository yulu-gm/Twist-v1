/**
 * @file item.queries.ts
 * @description 物品查询函数，提供按地图获取物品列表、按ID查找、按坐标筛选等功能
 * @dependencies world/game-map, core/types, item.types
 * @part-of features/item 物品功能模块
 */

import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import type { Item } from './item.types';

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
 * 获取指定坐标上的所有可搬运物品
 * @param map - 游戏地图对象
 * @param x - 格子X坐标
 * @param y - 格子Y坐标
 * @returns 该坐标上带有 'haulable' 标签的物品数组
 */
export function getItemsAt(map: GameMap, x: number, y: number): Item[] {
  return getAllItems(map).filter(i => i.cell.x === x && i.cell.y === y);
}
