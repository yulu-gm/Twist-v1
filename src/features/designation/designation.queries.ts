/**
 * @file designation.queries.ts
 * @description 指派查询函数——提供从地图中获取指派对象的便捷查询方法
 * @dependencies GameMap — 游戏地图类型；ObjectKind, DesignationType — 核心类型枚举；Designation — 指派类型
 * @part-of features/designation — 指派/工作指令功能
 */

import type { GameMap } from '../../world/game-map';
import { ObjectKind, DesignationType } from '../../core/types';
import type { Designation } from './designation.types';

/**
 * 获取地图上的所有指派对象
 * @param map - 游戏地图实例
 * @returns 该地图中所有指派对象的数组
 */
export function getAllDesignations(map: GameMap): Designation[] {
  return map.objects.allOfKind(ObjectKind.Designation) as unknown as Designation[];
}

/**
 * 按指派类型筛选获取指定类型的指派对象
 * @param map - 游戏地图实例
 * @param type - 指派类型（采集/挖矿/砍伐等）
 * @returns 匹配指定类型的指派对象数组
 */
export function getDesignationsByType(map: GameMap, type: DesignationType): Designation[] {
  return getAllDesignations(map).filter(d => d.designationType === type);
}
