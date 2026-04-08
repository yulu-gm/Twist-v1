/**
 * @file save.types.ts
 * @description 存档数据的类型定义，描述完整的游戏存档结构和单个地图的存档结构
 * @dependencies core/types — SimSpeed、MapId、TerrainDefId
 * @part-of features/save — 存档/读档功能模块
 */

import { SimSpeed, MapId, TerrainDefId } from '../../core/types';

/**
 * 完整游戏存档数据
 *
 * 包含世界的所有可序列化状态：版本、时钟、RNG、速度、
 * 地图列表、派系、故事状态和对象 ID 计数器。
 */
export interface SaveData {
  /** 存档格式版本号，用于迁移兼容 */
  version: number;
  /** 当前游戏 tick 数 */
  tick: number;
  /** 游戏时钟状态 */
  clockState: {
    /** 累计总 tick 数 */
    totalTicks: number;
    /** 当天小时 */
    hour: number;
    /** 当前天数 */
    day: number;
    /** 当前季节 */
    season: number;
    /** 当前年份 */
    year: number;
  };
  /** 随机数生成器种子状态，用于确定性重放 */
  rngState: number;
  /** 游戏速度（暂停/1x/2x/3x） */
  speed: SimSpeed;
  /** 所有地图的存档数据 */
  maps: MapSaveData[];
  /** 派系列表 */
  factions: { id: string; name: string; isPlayer: boolean; hostile: boolean }[];
  /** 故事生成器状态 */
  storyState: { threatLevel: number; daysSinceLastRaid: number; totalWealth: number };
  /** 下一个可用的对象 ID 计数器 */
  nextObjectId: number;
}

/**
 * 单个地图的存档数据
 *
 * 包含地形网格、所有地图对象、区域和预约信息。
 */
export interface MapSaveData {
  /** 地图唯一标识 */
  id: MapId;
  /** 地图宽度（格子数） */
  width: number;
  /** 地图高度（格子数） */
  height: number;
  /** 地形定义 ID 平铺数组（行优先） */
  terrain: TerrainDefId[];  // flat array, row-major
  /** 序列化后的地图对象数组 */
  objects: any[];  // serialized MapObjects
  /** 区域数据 */
  zones: any[];
  /** 预约数据 */
  reservations: any[];
}
