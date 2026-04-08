/**
 * @file zone.commands.ts
 * @description 区域命令处理器——处理区域的创建/扩展（zone_set_cells）和删除（zone_delete）
 * @dependencies MapId, ZoneId, CellCoordKey, cellKey, CellCoord — 核心类型；
 *              CommandHandler, Command, ValidationResult, ExecutionResult — 命令总线接口；
 *              World — 世界状态；Zone — 区域类型
 * @part-of features/zone — 区域管理功能
 */

import {
  MapId,
  ZoneId,
  CellCoordKey,
  cellKey,
  CellCoord,
} from '../../core/types';
import {
  CommandHandler,
  Command,
  ValidationResult,
  ExecutionResult,
} from '../../core/command-bus';
import { World } from '../../world/world';
import { Zone } from '../../world/game-map';

/** 区域ID自增计数器 */
let _nextZoneId = 1;
/**
 * 生成下一个唯一区域ID
 * @returns 格式为 "zone_N" 的区域ID
 */
function nextZoneId(): ZoneId {
  return `zone_${_nextZoneId++}`;
}

// ── zone_set_cells（设置区域格子） ──

/**
 * 设置区域格子命令处理器
 * 验证：检查地图存在性、cells 数组非空、所有格子在地图边界内
 * 执行：若指定了已存在的 zoneId 则扩展该区域；否则创建新区域
 *       发出 zone_updated 或 zone_created 事件
 */
export const zoneSetCellsHandler: CommandHandler = {
  type: 'zone_set_cells',

  validate(world: any, cmd: Command): ValidationResult {
    const { mapId, cells } = cmd.payload as {
      mapId: MapId;
      cells: CellCoord[];
    };
    const map = (world as World).maps.get(mapId);
    if (!map) return { valid: false, reason: `Map ${mapId} not found` };

    if (!cells || cells.length === 0) {
      return { valid: false, reason: 'No cells provided for zone' };
    }

    // 边界检查
    for (const cell of cells) {
      if (cell.x < 0 || cell.x >= map.width || cell.y < 0 || cell.y >= map.height) {
        return { valid: false, reason: `Cell (${cell.x},${cell.y}) out of bounds` };
      }
    }

    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const { mapId, zoneId, zoneType, cells, config } = cmd.payload as {
      mapId: MapId;
      zoneId?: ZoneId;
      zoneType: string;
      cells: CellCoord[];
      config?: Record<string, unknown>;
    };
    const map = w.maps.get(mapId)!;

    const cellKeys: Set<CellCoordKey> = new Set(cells.map(c => cellKey(c)));

    if (zoneId) {
      // 扩展已存在的区域——将新格子添加到现有区域
      const existing = map.zones.get(zoneId);
      if (existing) {
        for (const key of cellKeys) {
          existing.cells.add(key);
        }
        return {
          events: [{
            type: 'zone_updated',
            tick: w.tick,
            data: { zoneId, cellsAdded: cells.length },
          }],
        };
      }
    }

    // 创建新区域
    const id = zoneId ?? nextZoneId();
    const zone: Zone = {
      id,
      zoneType: zoneType,
      cells: cellKeys,
      config: config ?? {},
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

// ── zone_delete（删除区域） ──

/**
 * 删除区域命令处理器
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
  zoneDeleteHandler,
];
