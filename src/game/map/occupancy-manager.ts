/**
 * 格子占用：格键格式与 {@link coordKey} 一致；占用人 id 与世界实体 id（string）一致。
 */

import { coordKey, type GridCoord } from "./world-grid";

/** 底层结构与 {@link Map} 相同，便于克隆与序列化。 */
export type OccupancyMap = Map<string, string>;

export type OccupyOk = Readonly<{ ok: true }>;
export type OccupyConflict = Readonly<{
  ok: false;
  cell: GridCoord;
  occupantId: string;
}>;
export type OccupyResult = OccupyOk | OccupyConflict;

export type CellPlacementOk = Readonly<{ cell: GridCoord; ok: true }>;
export type CellPlacementBlocked = Readonly<{
  cell: GridCoord;
  ok: false;
  reason: "occupied";
  occupantId: string;
}>;
export type CellPlacementEntry = CellPlacementOk | CellPlacementBlocked;

export type PlacementCheck = Readonly<{
  entries: readonly CellPlacementEntry[];
  /** 当且仅当所有格均可放置（在忽略选项下）。 */
  allClear: boolean;
  /** 第一个不可放置格（若有）。 */
  firstConflict?: Readonly<{ cell: GridCoord; occupantId: string }>;
}>;

export function createOccupancyMap(): OccupancyMap {
  return new Map();
}

export function getOccupant(map: ReadonlyMap<string, string>, cell: GridCoord): string | undefined {
  return map.get(coordKey(cell));
}

export function isOccupied(map: ReadonlyMap<string, string>, cell: GridCoord): boolean {
  return getOccupant(map, cell) !== undefined;
}

/**
 * 占用一格：空格或已被同一 `entityId` 占用则写入并成功；被其他实体占用则返回冲突且不修改。
 */
export function occupy(map: OccupancyMap, cell: GridCoord, entityId: string): OccupyResult {
  const key = coordKey(cell);
  const current = map.get(key);
  if (current !== undefined && current !== entityId) {
    return { ok: false, cell, occupantId: current };
  }
  map.set(key, entityId);
  return { ok: true };
}

/**
 * 释放占用：仅当当前占有人与 `entityId` 一致时删除该键；否则不修改（幂等）。
 */
export function release(map: OccupancyMap, cell: GridCoord, entityId: string): void {
  const key = coordKey(cell);
  if (map.get(key) !== entityId) return;
  map.delete(key);
}

export function checkPlacement(
  map: ReadonlyMap<string, string>,
  cells: readonly GridCoord[],
  options?: Readonly<{ ignoreOccupantId?: string }>
): PlacementCheck {
  const ignore = options?.ignoreOccupantId;
  const entries: CellPlacementEntry[] = [];
  let firstConflict: { cell: GridCoord; occupantId: string } | undefined;

  for (const cell of cells) {
    const occupantId = getOccupant(map, cell);
    if (!occupantId || occupantId === ignore) {
      entries.push({ cell, ok: true });
    } else {
      entries.push({ cell, ok: false, reason: "occupied", occupantId });
      if (!firstConflict) firstConflict = { cell, occupantId };
    }
  }

  return {
    entries,
    allClear: firstConflict === undefined,
    firstConflict
  };
}

/** 与移动/生成前冲突检测一致：跳过 `selfEntityId` 已占之格，返回首个阻挡者。 */
export function findBlockingOccupant(
  map: ReadonlyMap<string, string>,
  occupiedCells: readonly GridCoord[],
  selfEntityId?: string
): { blockingEntityId: string; blockingCell: GridCoord } | undefined {
  const { firstConflict } = checkPlacement(map, occupiedCells, {
    ignoreOccupantId: selfEntityId
  });
  if (!firstConflict) return undefined;
  return {
    blockingEntityId: firstConflict.occupantId,
    blockingCell: firstConflict.cell
  };
}

/** 批量写入实体占格（调用方已保证无第三方冲突，或与自身重复占格）。 */
export function writeEntityOccupancy(
  map: OccupancyMap,
  entityId: string,
  occupiedCells: readonly GridCoord[]
): void {
  for (const cell of occupiedCells) {
    occupy(map, cell, entityId);
  }
}

export function deleteEntityOccupancy(
  map: OccupancyMap,
  entityId: string,
  occupiedCells: readonly GridCoord[]
): void {
  for (const cell of occupiedCells) {
    release(map, cell, entityId);
  }
}
