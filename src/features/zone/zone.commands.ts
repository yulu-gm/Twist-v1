/**
 * @file zone.commands.ts
 * @description 区域命令处理器——处理区域的创建（zone_set_cells）、按格擦除（zone_remove_cells）和删除（zone_delete）
 * @dependencies MapId, ZoneId, CellCoordKey, cellKey, CellCoord, ZoneType — 核心类型；
 *              CommandHandler, Command, ValidationResult, ExecutionResult — 命令总线接口；
 *              World — 世界状态；Zone/ZoneConfig — 区域类型与配置
 * @part-of features/zone — 区域管理功能
 */

import {
  MapId,
  ZoneId,
  CellCoordKey,
  cellKey,
  CellCoord,
  ZoneType,
} from '../../core/types';
import {
  CommandHandler,
  Command,
  ValidationResult,
  ExecutionResult,
} from '../../core/command-bus';
import { World } from '../../world/world';
import type { Zone } from './zone.types';
import {
  createDefaultZoneConfig,
  normalizeZoneConfig,
} from './zone.types';

/** 区域ID自增计数器 */
let _nextZoneId = 1;
/**
 * 生成下一个唯一区域ID
 * @returns 格式为 "zone_N" 的区域ID
 */
function nextZoneId(): ZoneId {
  return `zone_${_nextZoneId++}`;
}

function isZoneType(value: unknown): value is ZoneType {
  return Object.values(ZoneType).includes(value as ZoneType);
}

function toCellKeys(cells: CellCoord[]): CellCoordKey[] {
  return Array.from(new Set(cells.map(cellKey)));
}

// ── zone_set_cells（设置区域格子） ──

/**
 * 创建新区域命令处理器
 * 验证：检查地图存在性、zoneType 合法、cells 数组非空、所有格子在地图边界内且未被其他区域占用
 * 执行：始终创建一个新的区域对象
 */
export const zoneSetCellsHandler: CommandHandler = {
  type: 'zone_set_cells',

  validate(world: any, cmd: Command): ValidationResult {
    const { mapId, zoneType, cells } = cmd.payload as {
      mapId: MapId;
      zoneType: unknown;
      cells: CellCoord[];
    };
    const map = (world as World).maps.get(mapId);
    if (!map) return { valid: false, reason: `Map ${mapId} not found` };

    if (!isZoneType(zoneType)) {
      return { valid: false, reason: `Invalid zone type: ${String(zoneType)}` };
    }

    if (!cells || cells.length === 0) {
      return { valid: false, reason: 'No cells provided for zone' };
    }

    const uniqueCellKeys = toCellKeys(cells);

    // 边界和占用检查
    for (const cell of cells) {
      if (cell.x < 0 || cell.x >= map.width || cell.y < 0 || cell.y >= map.height) {
        return { valid: false, reason: `Cell (${cell.x},${cell.y}) out of bounds` };
      }
    }

    for (const key of uniqueCellKeys) {
      const occupiedZone = map.zones.getZoneAt(key);
      if (occupiedZone) {
        return {
          valid: false,
          reason: `Cell ${key} already belongs to zone ${occupiedZone.id}`,
        };
      }
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const { mapId, zoneType, cells, config } = cmd.payload as {
      mapId: MapId;
      zoneType: ZoneType;
      cells: CellCoord[];
      config?: unknown;
    };
    const map = w.maps.get(mapId)!;

    const id = nextZoneId();
    const cellKeys = toCellKeys(cells);
    const zone: Zone = {
      id,
      zoneType,
      cells: new Set(cellKeys),
      config: config ? normalizeZoneConfig(zoneType, config) : createDefaultZoneConfig(zoneType),
    };
    map.zones.add(zone);

    return {
      events: [{
        type: 'zone_created',
        tick: w.tick,
        data: { zoneId: id, zoneType, cellCount: cells.length },
      }],
    };
  },
};

// ── zone_remove_cells（按格擦除区域） ──

/**
 * 按格擦除区域命令处理器
 * 验证：检查地图存在性、cells 数组非空、所有格子在地图边界内
 * 执行：从命中的区域中移除这些格子；若区域被擦空则自动删除
 */
export const zoneRemoveCellsHandler: CommandHandler = {
  type: 'zone_remove_cells',

  validate(world: any, cmd: Command): ValidationResult {
    const { mapId, cells } = cmd.payload as {
      mapId: MapId;
      cells: CellCoord[];
    };
    const map = (world as World).maps.get(mapId);
    if (!map) return { valid: false, reason: `Map ${mapId} not found` };

    if (!cells || cells.length === 0) {
      return { valid: false, reason: 'No cells provided for zone removal' };
    }

    for (const cell of cells) {
      if (cell.x < 0 || cell.x >= map.width || cell.y < 0 || cell.y >= map.height) {
        return { valid: false, reason: `Cell (${cell.x},${cell.y}) out of bounds` };
      }
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const { mapId, cells } = cmd.payload as {
      mapId: MapId;
      cells: CellCoord[];
    };
    const map = w.maps.get(mapId)!;
    const result = map.zones.removeCells(toCellKeys(cells));

    if (result.removedCells.length === 0) {
      return { events: [] };
    }

    return {
      events: [{
        type: 'zone_updated',
        tick: w.tick,
        data: {
          removedCells: result.removedCells.length,
          affectedZoneIds: result.affectedZoneIds,
          deletedZoneIds: result.deletedZoneIds,
        },
      }],
    };
  },
};

// ── zone_delete（删除整个区域） ──

/**
 * 删除整个区域命令处理器
 * 验证：检查地图存在性、区域存在性
 * 执行：从地图中移除指定区域，发出 zone_deleted 事件
 */
export const zoneDeleteHandler: CommandHandler = {
  type: 'zone_delete',

  validate(world: any, cmd: Command): ValidationResult {
    const { mapId, zoneId } = cmd.payload as {
      mapId: MapId;
      zoneId: ZoneId;
    };
    const map = (world as World).maps.get(mapId);
    if (!map) return { valid: false, reason: `Map ${mapId} not found` };

    const zone = map.zones.get(zoneId);
    if (!zone) return { valid: false, reason: `Zone ${zoneId} not found` };

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const { mapId, zoneId } = cmd.payload as {
      mapId: MapId;
      zoneId: ZoneId;
    };
    const map = w.maps.get(mapId)!;
    map.zones.remove(zoneId);

    return {
      events: [{
        type: 'zone_deleted',
        tick: w.tick,
        data: { zoneId },
      }],
    };
  },
};

/** 所有区域命令处理器数组，用于批量注册到命令总线 */
export const zoneCommandHandlers: CommandHandler[] = [
  zoneSetCellsHandler,
  zoneRemoveCellsHandler,
  zoneDeleteHandler,
];
