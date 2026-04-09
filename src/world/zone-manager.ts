/**
 * @file zone-manager.ts
 * @description 区域（Zone）接口与区域管理器（ZoneManager），管理地图上玩家划定的功能区域
 * @dependencies core/types — CellCoordKey, ZoneId
 * @part-of world 模块——游戏世界数据层
 */

import { CellCoordKey, ZoneId } from '../core/types';

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
