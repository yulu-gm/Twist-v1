/**
 * @file zone.queries.ts
 * @description 区域查询函数——提供从地图中获取区域对象的便捷查询方法
 * @dependencies GameMap, Zone — 来自 world/game-map
 * @part-of features/zone — 区域管理功能
 */

import type { GameMap } from '../../world/game-map';
import type { Zone } from '../../world/game-map';

/**
 * 获取地图上的所有区域
 * @param map - 游戏地图实例
 * @returns 该地图中所有区域对象的数组
 */
export function getAllZones(map: GameMap): Zone[] {
  return map.zones.getAll();
}

/**
 * 根据格子键查找该位置所属的区域
 * @param map - 游戏地图实例
 * @param key - 格子坐标键（CellCoordKey 字符串）
 * @returns 包含该格子的区域对象，若不存在则返回 undefined
 */
export function getZoneAt(map: GameMap, key: string): Zone | undefined {
  return map.zones.getZoneAt(key);
}
