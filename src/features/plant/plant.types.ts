/**
 * @file plant.types.ts
 * @description 植物（Plant）类型定义，描述地图上的植物对象及其生长/收获/枯萎状态
 * @dependencies core/types（MapObjectBase, ObjectKind）
 * @part-of 植物系统（plant）
 */

import { MapObjectBase, ObjectKind } from '../../core/types';

/**
 * 植物接口 —— 地图上的植物实体，追踪生长周期与收获状态
 */
export interface Plant extends MapObjectBase {
  /** 对象类型标识：植物 */
  kind: ObjectKind.Plant;
  /** 生长进度，范围 0（刚种下）到 1（完全成熟） */
  growthProgress: number;
  /** 当前视觉生长阶段索引，用于渲染不同阶段的贴图 */
  growthStage: number;
  /** 是否为玩家播种（true = 玩家种植，false = 野生生成） */
  sownByPlayer: boolean;
  /** 是否已准备好收获 */
  harvestReady: boolean;
  /** 枯萎进度，范围 0（健康）到 1（死亡） */
  dyingProgress: number;
}
