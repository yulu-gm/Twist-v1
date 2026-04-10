/**
 * @file zone-manager.ts
 * @description 区域（Zone）接口与区域管理器（ZoneManager），管理地图上玩家划定的功能区域
 * @dependencies core/types — CellCoordKey, ZoneId, ZoneType, DefId
 * @part-of world 模块——游戏世界数据层
 */

import { CellCoordKey, DefId, ZoneId, ZoneType } from '../core/types';

/** 存储区配置：默认允许所有 haulable 物品，后续可扩展白名单筛选 */
export interface StockpileZoneConfig {
  /** 是否允许所有 haulable 物品进入 */
  allowAllHaulable: boolean;
  /** 显式允许的物品定义 ID 集合；allowAllHaulable 为 false 时生效 */
  allowedDefIds: Set<DefId>;
}

/** 区域配置集合，按区域类型挂载对应的配置块 */
export type ZoneConfig = Record<string, unknown> & {
  stockpile?: StockpileZoneConfig;
};

/** 区域：地图上由玩家划定的功能区域（如存储区、种植区等） */
export interface Zone {
  /** 区域唯一标识符 */
  id: ZoneId;
  /** 区域类型（如 stockpile, growing 等） */
  zoneType: ZoneType;
  /** 区域包含的所有格子坐标（使用 CellCoordKey 便于快速查找） */
  cells: Set<CellCoordKey>;
  /** 区域的额外配置 */
  config: ZoneConfig;
}

/** 批量添加格子的结果摘要 */
export interface ZoneCellAddResult {
  addedCells: CellCoordKey[];
  replacedZoneIds: ZoneId[];
  deletedZoneIds: ZoneId[];
}

/** 批量移除格子的结果摘要 */
export interface ZoneCellRemoveResult {
  removedCells: CellCoordKey[];
  affectedZoneIds: ZoneId[];
  deletedZoneIds: ZoneId[];
}

/** 创建 stockpile 区域的默认配置 */
export function createDefaultStockpileZoneConfig(): StockpileZoneConfig {
  return {
    allowAllHaulable: true,
    allowedDefIds: new Set<DefId>(),
  };
}

/** 创建指定区域类型的默认配置 */
export function createDefaultZoneConfig(zoneType: ZoneType): ZoneConfig {
  switch (zoneType) {
    case ZoneType.Stockpile:
      return { stockpile: createDefaultStockpileZoneConfig() };
    default:
      return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStockpileConfig(value: unknown): StockpileZoneConfig {
  if (!isRecord(value)) {
    return createDefaultStockpileZoneConfig();
  }

  const allowedDefIds = value.allowedDefIds;
  const allowedSet = allowedDefIds instanceof Set
    ? new Set<DefId>(Array.from(allowedDefIds).filter((defId): defId is DefId => typeof defId === 'string'))
    : Array.isArray(allowedDefIds)
      ? new Set<DefId>(allowedDefIds.filter((defId): defId is DefId => typeof defId === 'string'))
      : new Set<DefId>();

  return {
    allowAllHaulable: value.allowAllHaulable !== false,
    allowedDefIds: allowedSet,
  };
}

/** 归一化区域配置，补齐缺省值并恢复序列化后的 Set */
export function normalizeZoneConfig(zoneType: ZoneType, config?: unknown): ZoneConfig {
  const normalized: ZoneConfig = isRecord(config) ? { ...config } : {};

  switch (zoneType) {
    case ZoneType.Stockpile:
      normalized.stockpile = normalizeStockpileConfig(normalized.stockpile);
      break;
    default:
      break;
  }

  return normalized;
}

/**
 * ZoneManager 管理地图上所有区域的增删查操作
 */
export class ZoneManager {
  /** 所有区域的映射表 */
  private zones: Map<ZoneId, Zone> = new Map();

  /** 格子到区域的索引，保证查找格子所属区域为 O(1) */
  private cellIndex: Map<CellCoordKey, ZoneId> = new Map();

  /**
   * 添加一个区域
   * @param zone - 要添加的区域对象
   */
  add(zone: Zone): void {
    const normalized: Zone = {
      ...zone,
      cells: new Set(zone.cells),
      config: normalizeZoneConfig(zone.zoneType, zone.config),
    };

    // 先清理同 ID 的旧区域，再把新区域写入索引
    this.remove(normalized.id);
    this.zones.set(normalized.id, normalized);
    this.indexCells(normalized.id, normalized.cells);
  }

  /**
   * 向指定区域批量添加格子
   * @param zoneId - 区域ID
   * @param cellKeys - 待添加的格子键集合
   */
  addCells(zoneId: ZoneId, cellKeys: Iterable<CellCoordKey>): ZoneCellAddResult {
    const zone = this.zones.get(zoneId);
    if (!zone) {
      return { addedCells: [], replacedZoneIds: [], deletedZoneIds: [] };
    }

    const addedCells = new Set<CellCoordKey>();
    const replacedZoneIds = new Set<ZoneId>();
    const deletedZoneIds = new Set<ZoneId>();

    for (const key of new Set(cellKeys)) {
      this.claimCell(zoneId, key, addedCells, replacedZoneIds, deletedZoneIds);
    }

    return {
      addedCells: Array.from(addedCells),
      replacedZoneIds: Array.from(replacedZoneIds),
      deletedZoneIds: Array.from(deletedZoneIds),
    };
  }

  /**
   * 移除指定区域
   * @param id - 要移除的区域ID
   */
  remove(id: ZoneId): Zone | undefined {
    const zone = this.zones.get(id);
    if (!zone) {
      return undefined;
    }

    for (const key of zone.cells) {
      if (this.cellIndex.get(key) === id) {
        this.cellIndex.delete(key);
      }
    }

    this.zones.delete(id);
    return zone;
  }

  /**
   * 从所有区域中批量移除指定格子
   * @param cellKeys - 待移除的格子键集合
   */
  removeCells(cellKeys: Iterable<CellCoordKey>): ZoneCellRemoveResult {
    const removedCells = new Set<CellCoordKey>();
    const affectedZoneIds = new Set<ZoneId>();
    const deletedZoneIds = new Set<ZoneId>();

    for (const key of new Set(cellKeys)) {
      const zoneId = this.cellIndex.get(key);
      if (!zoneId) {
        continue;
      }

      const zone = this.zones.get(zoneId);
      this.cellIndex.delete(key);

      if (!zone) {
        continue;
      }

      if (zone.cells.delete(key)) {
        removedCells.add(key);
        affectedZoneIds.add(zoneId);
      }

      if (zone.cells.size === 0) {
        this.remove(zoneId);
        deletedZoneIds.add(zoneId);
      }
    }

    return {
      removedCells: Array.from(removedCells),
      affectedZoneIds: Array.from(affectedZoneIds),
      deletedZoneIds: Array.from(deletedZoneIds),
    };
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
    const zoneId = this.cellIndex.get(key);
    return zoneId ? this.zones.get(zoneId) : undefined;
  }

  /**
   * 将一组格子写入指定区域的索引
   * @param zoneId - 区域ID
   * @param cellKeys - 区域格子键集合
   */
  private indexCells(zoneId: ZoneId, cellKeys: Iterable<CellCoordKey>): void {
    for (const key of new Set(cellKeys)) {
      this.claimCell(zoneId, key);
    }
  }

  /**
   * 将单个格子归属给某个区域；若原先属于其他区域，则先从旧区域移除
   */
  private claimCell(
    zoneId: ZoneId,
    key: CellCoordKey,
    addedCells?: Set<CellCoordKey>,
    replacedZoneIds?: Set<ZoneId>,
    deletedZoneIds?: Set<ZoneId>,
  ): void {
    const zone = this.zones.get(zoneId);
    if (!zone) {
      return;
    }

    const previousZoneId = this.cellIndex.get(key);
    if (previousZoneId && previousZoneId !== zoneId) {
      const previousZone = this.zones.get(previousZoneId);
      if (previousZone && previousZone.cells.delete(key)) {
        replacedZoneIds?.add(previousZoneId);
        if (previousZone.cells.size === 0) {
          this.remove(previousZoneId);
          deletedZoneIds?.add(previousZoneId);
        }
      }
    }

    zone.cells.add(key);
    this.cellIndex.set(key, zoneId);
    addedCells?.add(key);
  }
}
