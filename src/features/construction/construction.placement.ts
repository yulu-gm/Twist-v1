/**
 * @file construction.placement.ts
 * @description 共享建造放置判定 — 判断某个 footprint 是否允许放置蓝图
 * @dependencies core/types — ObjectKind、MapObjectBase；world/occupancy — footprint 命中查询
 * @part-of 建造系统（construction）
 */

import { ObjectKind } from '../../core/types';
import type { Footprint, CellCoord, MapObjectBase } from '../../core/types';
import type { GameMap } from '../../world/game-map';
import { getObjectsInFootprint } from '../../world/occupancy';

/** 放置冲突原因 */
export type BuildingPlacementBlockReason = 'occupied_by_construction_or_building';

/** 放置判定结果 */
export interface BuildingPlacementAnalysis {
  /** 是否被阻止放置 */
  blocked: boolean;
  /** 冲突对象列表 */
  blockingObjects: MapObjectBase[];
  /** 冲突原因（无冲突时为 null） */
  reason: BuildingPlacementBlockReason | null;
}

/** 判断对象是否属于建造占地冲突对象（蓝图、工地、建筑） */
function isBlockingPlacementObject(obj: MapObjectBase): boolean {
  return obj.kind === ObjectKind.Blueprint
    || obj.kind === ObjectKind.ConstructionSite
    || obj.kind === ObjectKind.Building;
}

/**
 * 分析目标位置是否允许放置建筑蓝图
 *
 * 规则：
 * - footprint 内存在 Blueprint / ConstructionSite / Building → blocked
 * - Pawn / Item 不构成放置冲突
 * - 多格 footprint 任一格命中冲突对象即整体 blocked
 *
 * @param map - 游戏地图
 * @param cell - 目标左上角格子
 * @param footprint - 建筑占地尺寸
 * @returns 放置判定结果
 */
export function analyzeBuildingPlacement(
  map: GameMap,
  cell: CellCoord,
  footprint: Footprint,
): BuildingPlacementAnalysis {
  const blockingObjects = getObjectsInFootprint(map, cell, footprint)
    .filter(isBlockingPlacementObject);

  if (blockingObjects.length > 0) {
    return {
      blocked: true,
      blockingObjects,
      reason: 'occupied_by_construction_or_building',
    };
  }

  return {
    blocked: false,
    blockingObjects: [],
    reason: null,
  };
}
