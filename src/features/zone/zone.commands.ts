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
  CellCoord,
  cellKey,
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
import {
  buildZoneCellPlacementPlan,
  getNextZoneId,
  analyzeZoneCellPlacement,
} from './zone.analysis';

function isZoneType(value: unknown): value is ZoneType {
  return Object.values(ZoneType).includes(value as ZoneType);
}

function toCellKeys(cells: CellCoord[]): CellCoordKey[] {
  return Array.from(new Set(cells.map(cellKey)));
}

// ── zone_set_cells（设置区域格子） ──

/**
 * 创建新区域命令处理器
 * 验证：检查地图存在性、zoneType 合法、cells 数组非空，且至少有一个有效格子
 * 执行：复用 ZoneManager 的 add / addCells 语义，按分析结果执行创建、扩展或合并
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

    const analysis = analyzeZoneCellPlacement(map, zoneType, cells);
    if (analysis.validCellCount === 0) {
      return { valid: false, reason: 'No valid cells provided for zone' };
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
    const plan = buildZoneCellPlacementPlan(map, zoneType, cells);

    if (plan.analysis.validCellCount === 0) {
      return { events: [] };
    }

    let zoneId: ZoneId;
    let created = false;

    if (plan.analysis.targetZoneId === null) {
      zoneId = getNextZoneId(w);
      created = true;

      const zone: Zone = {
        id: zoneId,
        zoneType,
        cells: new Set(plan.cellsToAdd),
        config: config ? normalizeZoneConfig(zoneType, config) : createDefaultZoneConfig(zoneType),
      };
      map.zones.add(zone);
    } else {
      zoneId = plan.analysis.targetZoneId;
      map.zones.addCells(zoneId, plan.cellsToAdd);
    }

    const shouldEmitSummary = created || plan.addedCellCount > 0 || plan.analysis.invalidCellCount > 0;
    if (!shouldEmitSummary) {
      return { events: [] };
    }

    const summaryData = {
      zoneId,
      zoneType,
      created,
      addedCellCount: plan.addedCellCount,
      mergedZoneIds: plan.analysis.mergedZoneIds,
      invalidCellCount: plan.analysis.invalidCellCount,
    };

    const events = created
      ? [
          {
            type: 'zone_created',
            tick: w.tick,
            data: {
              zoneId,
              zoneType,
              cellCount: plan.addedCellCount,
            },
          },
          {
            type: 'zone_updated',
            tick: w.tick,
            data: summaryData,
          },
        ]
      : [{
          type: 'zone_updated',
          tick: w.tick,
          data: summaryData,
        }];

    return { events };
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
