/**
 * @file construction.queries.ts
 * @description 建造系统查询函数，提供获取蓝图和施工工地的便捷方法
 * @dependencies world/game-map, core/types, blueprint.types, construction-site.types
 * @part-of 建造系统（construction）
 */

import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import type { Blueprint } from './blueprint.types';
import type { ConstructionSite } from './construction-site.types';

/**
 * 获取指定地图上的所有蓝图对象
 * @param map - 目标地图实例
 * @returns 该地图上所有 Blueprint 对象的数组
 */
export function getAllBlueprints(map: GameMap): Blueprint[] {
  return map.objects.allOfKind(ObjectKind.Blueprint) as unknown as Blueprint[];
}

/**
 * 获取指定地图上的所有施工工地对象
 * @param map - 目标地图实例
 * @returns 该地图上所有 ConstructionSite 对象的数组
 */
export function getAllConstructionSites(map: GameMap): ConstructionSite[] {
  return map.objects.allOfKind(ObjectKind.ConstructionSite) as unknown as ConstructionSite[];
}
