/**
 * @file game-map.ts
 * @description 游戏地图（GameMap）接口与工厂函数。
 *              子系统定义分布在独立文件中：zone-manager、room-graph、reservation-table、path-grid。
 * @dependencies core/types, core/grid, core/object-pool, core/spatial-index,
 *               world/zone-manager, world/room-graph, world/reservation-table, world/path-grid
 * @part-of world 模块——游戏世界数据层
 */

import { MapId, TerrainDefId } from '../core/types';
import { Grid } from '../core/grid';
import { ObjectPool } from '../core/object-pool';
import { SpatialIndex } from '../core/spatial-index';
import { ZoneManager } from './zone-manager';
import { RoomGraph } from './room-graph';
import { ReservationTable } from './reservation-table';
import { PathGrid } from './path-grid';

// ── Re-exports（保持现有 import 路径兼容） ──
export type { Zone } from './zone-manager';
export { ZoneManager } from './zone-manager';
export type { Room } from './room-graph';
export { RoomGraph } from './room-graph';
export type { Reservation } from './reservation-table';
export { ReservationTable } from './reservation-table';
export { PathGrid } from './path-grid';

// ── 游戏地图 ──
/** GameMap 是单个地图的完整数据结构，包含地形、对象、区域、房间等所有子系统 */
export interface GameMap {
  /** 地图唯一标识符 */
  id: MapId;
  /** 地图宽度（格子数） */
  width: number;
  /** 地图高度（格子数） */
  height: number;
  /** 地形网格（每格存储地形定义ID） */
  terrain: Grid<TerrainDefId>;
  /** 地图对象池（管理所有建筑、物品、角色等实体） */
  objects: ObjectPool;
  /** 空间索引（按格子快速查找对象） */
  spatial: SpatialIndex;
  /** 区域管理器 */
  zones: ZoneManager;
  /** 房间图（封闭空间检测） */
  rooms: RoomGraph;
  /** 预订表（角色对对象的独占预订） */
  reservations: ReservationTable;
  /** 寻路网格（可通行性数据） */
  pathGrid: PathGrid;
  /** 温度网格（每格的温度值） */
  temperature: Grid<number>;
  /** 美观度网格（每格的美观度值） */
  beauty: Grid<number>;
}

/**
 * 创建一个新的游戏地图实例
 * @param config.id - 地图ID
 * @param config.width - 地图宽度
 * @param config.height - 地图高度
 * @returns 初始化完成的 GameMap 对象（默认地形为草地，温度20度，美观度0）
 */
export function createGameMap(config: { id: MapId; width: number; height: number }): GameMap {
  const { id, width, height } = config;

  const spatial = new SpatialIndex(width, height);
  const objects = new ObjectPool({
    onAdd: (obj) => {
      spatial.onObjectAdded(obj.id, obj.cell, obj.footprint, obj.tags.has('impassable'));
    },
    onRemove: (obj) => {
      spatial.onObjectRemoved(obj.id, obj.cell, obj.footprint);
    },
  });

  return {
    id,
    width,
    height,
    terrain: new Grid<TerrainDefId>(width, height, 'grass'),
    objects,
    spatial,
    zones: new ZoneManager(),
    rooms: new RoomGraph(),
    reservations: new ReservationTable(),
    pathGrid: new PathGrid(width, height),
    temperature: new Grid<number>(width, height, 20),
    beauty: new Grid<number>(width, height, 0),
  };
}
