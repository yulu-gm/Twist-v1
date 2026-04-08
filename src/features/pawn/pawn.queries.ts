/**
 * @file pawn.queries.ts
 * @description 棋子查询函数，提供按地图获取棋子列表、按ID查找、筛选空闲棋子等功能
 * @dependencies world/game-map, core/types, pawn.types
 * @part-of features/pawn 棋子功能模块
 */

import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import type { Pawn } from './pawn.types';

/**
 * 获取地图上的所有棋子
 * @param map - 游戏地图对象
 * @returns 该地图上所有棋子的数组
 */
export function getAllPawns(map: GameMap): Pawn[] {
  return map.objects.allOfKind(ObjectKind.Pawn) as unknown as Pawn[];
}

/**
 * 按ID查找棋子
 * @param map - 游戏地图对象
 * @param id - 棋子的对象ID
 * @returns 找到的棋子对象，未找到则返回 undefined
 */
export function getPawnById(map: GameMap, id: string): Pawn | undefined {
  const obj = map.objects.get(id);
  if (obj && obj.kind === ObjectKind.Pawn) return obj as unknown as Pawn;
  return undefined;
}

/**
 * 获取地图上所有空闲的棋子（当前无工作的棋子）
 * @param map - 游戏地图对象
 * @returns 空闲棋子数组
 */
export function getIdlePawns(map: GameMap): Pawn[] {
  return getAllPawns(map).filter(p => p.ai.currentJob === null);
}
