/**
 * @file building.queries.ts
 * @description 建筑系统查询函数，提供按列表或按ID获取建筑的便捷方法
 * @dependencies world/game-map, core/types, building.types
 * @part-of 建筑系统（building）
 */

import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import type { Building } from './building.types';

/**
 * 获取指定地图上的所有建筑对象
 * @param map - 目标地图实例
 * @returns 该地图上所有 Building 对象的数组
 */
export function getAllBuildings(map: GameMap): Building[] {
  return map.objects.allOfKind(ObjectKind.Building);
}

/**
 * 根据ID获取指定建筑对象
 * @param map - 目标地图实例
 * @param id - 建筑对象的唯一标识符
 * @returns 匹配的 Building 对象，若不存在或类型不匹配则返回 undefined
 */
export function getBuildingById(map: GameMap, id: string): Building | undefined {
  const obj = map.objects.get(id);
  if (obj && obj.kind === ObjectKind.Building) return obj as Building;
  return undefined;
}

/** 获取地图上所有带 bed 组件的建筑 */
export function getAllBeds(map: GameMap): Building[] {
  return getAllBuildings(map).filter(building => building.bed !== undefined);
}

/** 根据所有者棋子ID查找对应的床位建筑 */
export function getBedByOwner(map: GameMap, ownerName: string): Building | undefined {
  return getAllBeds(map).find(building => building.bed?.ownerPawnId === ownerName);
}

/** 判断床位是否当前无人占用 */
export function isBedAvailable(building: Building): boolean {
  return building.bed !== undefined && building.bed.occupantPawnId === undefined;
}

/** 判断床位是否归指定棋子所有 */
export function isBedOwnedBy(building: Building, ownerName: string): boolean {
  return building.bed?.ownerPawnId === ownerName;
}

/** 查找第一个可自动分配且当前无主无人的床位 */
export function findAvailableAutoAssignableBed(map: GameMap): Building | undefined {
  return getAllBeds(map).find(building => (
    building.bed?.autoAssignable === true
    && building.bed.ownerPawnId === undefined
    && isBedAvailable(building)
  ));
}
