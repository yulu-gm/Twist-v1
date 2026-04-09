/**
 * @file room-graph.ts
 * @description 房间（Room）接口与房间图（RoomGraph），管理地图上封闭空间的检测与重建
 * @dependencies core/types — CellCoordKey
 * @part-of world 模块——游戏世界数据层
 */

import { CellCoordKey } from '../core/types';
import type { GameMap } from './game-map';

/** 房间：由墙壁围成的封闭空间 */
export interface Room {
  /** 房间唯一标识符 */
  id: string;
  /** 房间包含的所有格子坐标 */
  cells: Set<CellCoordKey>;
  /** 是否为露天（无屋顶） */
  isOutdoor: boolean;
  /** 室内温度 */
  temperature: number;
  /** 房间美观度（影响角色心情） */
  impressiveness: number;
}

/**
 * RoomGraph 管理地图上所有房间的检测与重建。
 * 当地图结构变化时标记为脏（dirty），需要重新计算房间布局。
 */
export class RoomGraph {
  /** 所有房间列表 */
  rooms: Room[] = [];
  /** 是否需要重建（地图结构变化后设为 true） */
  dirty = true;

  /** 标记需要重建 */
  markDirty(): void { this.dirty = true; }

  /**
   * 重建房间图（根据地图中的墙壁重新检测封闭空间）
   * @param _map - 当前游戏地图
   */
  rebuild(_map: GameMap): void {
    // Simplified room detection — will be implemented in room system
    this.dirty = false;
  }
}
