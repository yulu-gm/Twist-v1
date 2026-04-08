/**
 * @file game-map.ts
 * @description 游戏地图（GameMap）及其子系统的定义与工厂函数。
 *              包含区域管理（ZoneManager）、房间图（RoomGraph）、
 *              资源预订表（ReservationTable）、寻路网格（PathGrid）等核心组件。
 * @dependencies core/types, core/grid, core/object-pool, core/spatial-index, world/def-database
 * @part-of world 模块——游戏世界数据层
 */

import { MapId, CellCoord, CellCoordKey, TerrainDefId, ObjectId, ZoneId, ObjectKind } from '../core/types';
import { Grid } from '../core/grid';
import { ObjectPool } from '../core/object-pool';
import { SpatialIndex } from '../core/spatial-index';
import type { MapObjectBase } from '../core/types';
import type { DefDatabase } from './def-database';

// ── 区域（Zone） ──
/** 区域：地图上由玩家划定的功能区域（如存储区、种植区等） */
export interface Zone {
  /** 区域唯一标识符 */
  id: ZoneId;
  /** 区域类型（如 "stockpile", "growing" 等） */
  zoneType: string;
  /** 区域包含的所有格子坐标（使用 CellCoordKey 便于快速查找） */
  cells: Set<CellCoordKey>;
  /** 区域的额外配置（如存储区允许的物品类型等） */
  config: Record<string, unknown>;
}

// ── 区域管理器 ──
/**
 * ZoneManager 管理地图上所有区域的增删查操作
 */
export class ZoneManager {
  /** 所有区域的映射表 */
  private zones: Map<ZoneId, Zone> = new Map();

  /**
   * 添加一个区域
   * @param zone - 要添加的区域对象
   */
  add(zone: Zone): void {
    this.zones.set(zone.id, zone);
  }

  /**
   * 移除指定区域
   * @param id - 要移除的区域ID
   */
  remove(id: ZoneId): void {
    this.zones.delete(id);
  }

  /**
   * 按ID获取区域
   * @param id - 区域ID
   * @returns 区域对象，不存在则返回 undefined
   */
  get(id: ZoneId): Zone | undefined {
    return this.zones.get(id);
  }

  /**
   * 获取所有区域列表
   * @returns 区域数组
   */
  getAll(): Zone[] {
    return Array.from(this.zones.values());
  }

  /**
   * 查找包含指定格子的区域
   * @param key - 格子坐标键
   * @returns 包含该格子的区域，不存在则返回 undefined
   */
  getZoneAt(key: CellCoordKey): Zone | undefined {
    for (const zone of this.zones.values()) {
      if (zone.cells.has(key)) return zone;
    }
    return undefined;
  }
}

// ── 房间（Room） ──
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

// ── 房间图 ──
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

// ── 预订记录 ──
/** 预订记录：角色对地图对象的独占性预订 */
export interface Reservation {
  /** 预订唯一标识符 */
  id: string;
  /** 预订者（角色）的对象ID */
  claimantId: ObjectId;
  /** 被预订目标的对象ID */
  targetId: ObjectId;
  /** 关联的工作ID */
  jobId: string;
  /** 预订的目标格子坐标（可选） */
  targetCell?: CellCoord;
  /** 预订过期的 tick 时刻 */
  expiresAtTick: number;
}

// ── 预订表 ──
/**
 * ReservationTable 管理角色对地图对象的预订。
 * 防止多个角色同时操作同一目标（如同时搬运同一物品）。
 */
export class ReservationTable {
  /** 所有预订记录（按预订ID索引） */
  private reservations: Map<string, Reservation> = new Map();
  /** 按目标对象ID快速查找预订ID */
  private byTarget: Map<ObjectId, string> = new Map();
  /** 自增的预订ID计数器 */
  private nextId = 1;

  /**
   * 尝试为目标创建预订
   * @param req.claimantId - 预订者ID
   * @param req.targetId - 目标对象ID
   * @param req.jobId - 关联工作ID
   * @param req.currentTick - 当前 tick
   * @param req.maxTick - 预订持续的最大 tick 数（默认5000）
   * @returns 成功返回预订ID，目标已被预订则返回 null
   */
  tryReserve(req: {
    claimantId: ObjectId;
    targetId: ObjectId;
    jobId: string;
    currentTick: number;
    maxTick?: number;
  }): string | null {
    if (this.byTarget.has(req.targetId)) return null;

    const id = `res_${this.nextId++}`;
    const reservation: Reservation = {
      id,
      claimantId: req.claimantId,
      targetId: req.targetId,
      jobId: req.jobId,
      expiresAtTick: req.currentTick + (req.maxTick ?? 5000),
    };
    this.reservations.set(id, reservation);
    this.byTarget.set(req.targetId, id);
    return id;
  }

  /**
   * 释放指定预订
   * @param id - 预订ID
   */
  release(id: string): void {
    const res = this.reservations.get(id);
    if (res) {
      this.byTarget.delete(res.targetId);
      this.reservations.delete(id);
    }
  }

  /**
   * 检查目标对象是否已被预订
   * @param targetId - 目标对象ID
   * @returns 是否已被预订
   */
  isReserved(targetId: ObjectId): boolean {
    return this.byTarget.has(targetId);
  }

  /**
   * 获取目标对象的预订记录
   * @param targetId - 目标对象ID
   * @returns 预订记录，不存在则返回 null
   */
  getReservation(targetId: ObjectId): Reservation | null {
    const id = this.byTarget.get(targetId);
    if (!id) return null;
    return this.reservations.get(id) ?? null;
  }

  /**
   * 获取指定角色的所有预订
   * @param pawnId - 角色对象ID
   * @returns 该角色持有的所有预订记录
   */
  getAllByPawn(pawnId: ObjectId): Reservation[] {
    return Array.from(this.reservations.values()).filter(r => r.claimantId === pawnId);
  }

  /**
   * 获取所有预订记录
   * @returns 所有预订记录数组
   */
  getAll(): Reservation[] {
    return Array.from(this.reservations.values());
  }

  /**
   * 清理所有已过期的预订
   * @param currentTick - 当前 tick
   */
  cleanupExpired(currentTick: number): void {
    for (const [id, res] of this.reservations) {
      if (currentTick >= res.expiresAtTick) {
        this.byTarget.delete(res.targetId);
        this.reservations.delete(id);
      }
    }
  }

  /**
   * 释放指定角色的所有预订
   * @param pawnId - 角色对象ID
   */
  releaseAllByPawn(pawnId: ObjectId): void {
    for (const [id, res] of this.reservations) {
      if (res.claimantId === pawnId) {
        this.byTarget.delete(res.targetId);
        this.reservations.delete(id);
      }
    }
  }

  /**
   * 释放指定工作关联的所有预订
   * @param jobId - 工作ID
   */
  releaseAllForJob(jobId: string): void {
    for (const [id, res] of this.reservations) {
      if (res.jobId === jobId) {
        this.byTarget.delete(res.targetId);
        this.reservations.delete(id);
      }
    }
  }
}

// ── 寻路网格 ──
/**
 * PathGrid 维护地图的可通行性网格，供寻路算法使用。
 * 综合考虑地形和建筑物的通行阻挡。
 */
export class PathGrid {
  /** 可通行性网格（true=可通行，false=不可通行） */
  private passable: Grid<boolean>;

  /**
   * 构造寻路网格
   * @param width - 地图宽度
   * @param height - 地图高度
   */
  constructor(width: number, height: number) {
    this.passable = new Grid(width, height, true);
  }

  /**
   * 检查指定格子是否可通行
   * @param x - 格子X坐标
   * @param y - 格子Y坐标
   * @returns 是否可通行（越界也返回 false）
   */
  isPassable(x: number, y: number): boolean {
    return this.passable.inBounds(x, y) && this.passable.get(x, y);
  }

  /**
   * 设置指定格子的可通行性
   * @param x - 格子X坐标
   * @param y - 格子Y坐标
   * @param value - 是否可通行
   */
  setPassable(x: number, y: number, value: boolean): void {
    if (this.passable.inBounds(x, y)) {
      this.passable.set(x, y, value);
    }
  }

  /** 地图宽度 */
  get width(): number { return this.passable.width; }
  /** 地图高度 */
  get height(): number { return this.passable.height; }

  /**
   * 根据地图数据重建整个可通行性网格
   * 先根据地形设置基础通行性，再叠加建筑物的阻挡
   * @param map - 游戏地图
   * @param defs - 定义数据库（可选，用于查询地形/建筑的通行属性）
   */
  rebuildFrom(map: GameMap, defs?: DefDatabase): void {
    const terrain = map.terrain;
    terrain.forEach((x, y, defId) => {
      if (defs) {
        const tDef = defs.terrains.get(defId);
        this.passable.set(x, y, tDef ? tDef.passable : true);
      } else {
        // 回退方案：使用硬编码的不可通行地形类型
        const impassable = defId === 'rock' || defId === 'water';
        this.passable.set(x, y, !impassable);
      }
    });
    // 标记阻挡移动的建筑物所占格子为不可通行
    map.objects.allOfKind(ObjectKind.Building).forEach((obj: MapObjectBase) => {
      if (defs) {
        const bDef = defs.buildings.get(obj.defId);
        if (bDef && bDef.blocksMovement) {
          const fp = obj.footprint ?? { width: 1, height: 1 };
          for (let dy = 0; dy < fp.height; dy++) {
            for (let dx = 0; dx < fp.width; dx++) {
              this.setPassable(obj.cell.x + dx, obj.cell.y + dy, false);
            }
          }
        }
      } else if (obj.tags.has('impassable')) {
        const fp = obj.footprint ?? { width: 1, height: 1 };
        for (let dy = 0; dy < fp.height; dy++) {
          for (let dx = 0; dx < fp.width; dx++) {
            this.setPassable(obj.cell.x + dx, obj.cell.y + dy, false);
          }
        }
      }
    });
  }
}

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
