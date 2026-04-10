/**
 * @file zone.analysis.ts
 * @description 区域格子分析与 ID 分配工具，供 zone 命令执行与输入预览复用
 * @part-of features/zone — 区域管理功能
 */

import { CellCoord, CellCoordKey, MapId, ZoneId, ZoneType, cellKey } from '../../core/types';
import type { GameMap } from '../../world/game-map';
import type { World } from '../../world/world';

/** 单个格子的区域分析结果 */
export interface ZoneCellAnalysisEntry {
  cell: CellCoord;
  key: CellCoordKey;
  status: 'empty' | 'same-type' | 'other-type' | 'out-of-bounds';
  zoneId?: ZoneId;
}

/** 区域格子分析摘要 */
export interface ZoneCellPlacementAnalysis {
  mapId: MapId;
  zoneType: ZoneType;
  requestedCells: CellCoord[];
  entries: ZoneCellAnalysisEntry[];
  emptyCells: CellCoord[];
  sameTypeCells: CellCoord[];
  otherTypeCells: CellCoord[];
  outOfBoundsCells: CellCoord[];
  validCells: CellCoord[];
  invalidCells: CellCoord[];
  touchedSameTypeZoneIds: ZoneId[];
  touchedOtherTypeZoneIds: ZoneId[];
  targetZoneId: ZoneId | null;
  created: boolean;
  mergedZoneIds: ZoneId[];
  validCellCount: number;
  invalidCellCount: number;
}

/** 区域写入计划 */
export interface ZoneCellPlacementPlan {
  analysis: ZoneCellPlacementAnalysis;
  cellsToAdd: CellCoordKey[];
  addedCellCount: number;
}

function isCellCoord(value: unknown): value is CellCoord {
  return typeof value === 'object'
    && value !== null
    && typeof (value as CellCoord).x === 'number'
    && typeof (value as CellCoord).y === 'number'
    && Number.isFinite((value as CellCoord).x)
    && Number.isFinite((value as CellCoord).y);
}

function collectUniqueCells(cells: Iterable<unknown>): CellCoord[] {
  const uniqueCells = new Map<CellCoordKey, CellCoord>();

  for (const value of cells) {
    if (!isCellCoord(value)) {
      continue;
    }
    const key = cellKey(value);
    if (!uniqueCells.has(key)) {
      uniqueCells.set(key, { x: value.x, y: value.y });
    }
  }

  return Array.from(uniqueCells.values());
}

function sortZoneIds(zoneIds: Iterable<ZoneId>): ZoneId[] {
  return Array.from(new Set(zoneIds)).sort((a, b) => a.localeCompare(b));
}

/**
 * 分析一次区域写入意图，区分空地、同类型区域、异类型区域和越界格子。
 */
export function analyzeZoneCellPlacement(
  map: Pick<GameMap, 'id' | 'width' | 'height' | 'zones'>,
  zoneType: ZoneType,
  cells: Iterable<unknown>,
): ZoneCellPlacementAnalysis {
  const requestedCells = collectUniqueCells(cells);
  const entries: ZoneCellAnalysisEntry[] = [];
  const emptyCells: CellCoord[] = [];
  const sameTypeCells: CellCoord[] = [];
  const otherTypeCells: CellCoord[] = [];
  const outOfBoundsCells: CellCoord[] = [];
  const touchedSameTypeZoneIds = new Set<ZoneId>();
  const touchedOtherTypeZoneIds = new Set<ZoneId>();

  for (const cell of requestedCells) {
    const key = cellKey(cell);

    if (cell.x < 0 || cell.x >= map.width || cell.y < 0 || cell.y >= map.height) {
      outOfBoundsCells.push(cell);
      entries.push({ cell, key, status: 'out-of-bounds' });
      continue;
    }

    const zone = map.zones.getZoneAt(key);
    if (!zone) {
      emptyCells.push(cell);
      entries.push({ cell, key, status: 'empty' });
      continue;
    }

    if (zone.zoneType === zoneType) {
      sameTypeCells.push(cell);
      touchedSameTypeZoneIds.add(zone.id);
      entries.push({ cell, key, status: 'same-type', zoneId: zone.id });
      continue;
    }

    otherTypeCells.push(cell);
    touchedOtherTypeZoneIds.add(zone.id);
    entries.push({ cell, key, status: 'other-type', zoneId: zone.id });
  }

  const sortedSameTypeZoneIds = sortZoneIds(touchedSameTypeZoneIds);
  const targetZoneId = sortedSameTypeZoneIds[0] ?? null;
  const mergedZoneIds = targetZoneId
    ? sortedSameTypeZoneIds.filter(zoneId => zoneId !== targetZoneId)
    : [];

  const validCells = [...emptyCells, ...sameTypeCells];
  const invalidCells = [...otherTypeCells, ...outOfBoundsCells];

  return {
    mapId: map.id,
    zoneType,
    requestedCells,
    entries,
    emptyCells,
    sameTypeCells,
    otherTypeCells,
    outOfBoundsCells,
    validCells,
    invalidCells,
    touchedSameTypeZoneIds: sortedSameTypeZoneIds,
    touchedOtherTypeZoneIds: sortZoneIds(touchedOtherTypeZoneIds),
    targetZoneId,
    created: targetZoneId === null && validCells.length > 0,
    mergedZoneIds,
    validCellCount: validCells.length,
    invalidCellCount: invalidCells.length,
  };
}

/**
 * 基于当前世界状态生成下一个可用的 zone ID。
 *
 * 不再依赖模块级计数器，而是每次按当前世界内已有 zone 的最大编号现算。
 */
export function getNextZoneId(world: Pick<World, 'maps'>): ZoneId {
  let maxZoneNumber = 0;

  for (const map of world.maps.values()) {
    for (const zone of map.zones.getAll()) {
      const match = /^zone_(\d+)$/.exec(zone.id);
      if (!match) {
        continue;
      }

      const zoneNumber = Number(match[1]);
      if (Number.isFinite(zoneNumber) && zoneNumber > maxZoneNumber) {
        maxZoneNumber = zoneNumber;
      }
    }
  }

  return `zone_${maxZoneNumber + 1}`;
}

/**
 * 生成一次区域写入计划。
 *
 * - 空地：直接写入新区域
 * - 同类型单个区域：扩展现有区域
 * - 同类型多个区域：以字典序最小的 zoneId 为锚点，合并其他同类型区域
 */
export function buildZoneCellPlacementPlan(
  map: Pick<GameMap, 'id' | 'width' | 'height' | 'zones'>,
  zoneType: ZoneType,
  cells: Iterable<unknown>,
): ZoneCellPlacementPlan {
  const analysis = analyzeZoneCellPlacement(map, zoneType, cells);

  if (analysis.targetZoneId === null) {
    return {
      analysis,
      cellsToAdd: analysis.emptyCells.map(cellKey),
      addedCellCount: analysis.emptyCells.length,
    };
  }

  const cellsToAdd = new Set<CellCoordKey>(analysis.emptyCells.map(cellKey));
  for (const zoneId of analysis.mergedZoneIds) {
    const zone = map.zones.get(zoneId);
    if (!zone) {
      continue;
    }
    for (const key of zone.cells) {
      cellsToAdd.add(key);
    }
  }

  return {
    analysis,
    cellsToAdd: Array.from(cellsToAdd),
    addedCellCount: cellsToAdd.size,
  };
}
