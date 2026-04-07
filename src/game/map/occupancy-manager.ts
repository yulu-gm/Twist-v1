/**
 * 实体占格索引：格键格式与 {@link coordKey} 一致；占用人 id 与世界实体 id（string）一致。
 *
 * 职责边界（与 oh-code-design「占用管理器」合一表述对齐方式）：本文件**仅**维护「可移动实体脚印 → 占用人」的
 * 索引。建筑/地形阻挡见 {@link WorldGridConfig.blockedCellKeys} 等网格配置；交互点临时预约见
 * `world-grid` 的 `ReservationSnapshot` 与行为层预约 API。完整可行走/可放置判定需在组合层同时查询上述来源。
 *
 * 数据结构：每格为实体 id **集合**，与 oh-gen-doc「地图格.包含实体」（实体引用列表）对齐。当前 `occupy` 仍
 * 禁止两个不同实体占同一格（与既有移动/生成冲突语义一致）；同格多实体可在后续放宽规则或分层索引后启用。
 */

import { coordKey, type GridCoord } from "./world-grid";

/** 底层为格键 → 实体 id 集合，便于克隆、序列化与扩展同格多实体。 */
export type OccupancyMap = Map<string, Set<string>>;

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

/** 批量写入占用：与 {@link checkPlacement} 同口径前置校验，失败时不修改地图。 */
export type WriteEntityOccupancyOk = Readonly<{ ok: true }>;
export type WriteEntityOccupancyBlocked = Readonly<{
  ok: false;
  conflicts: readonly Readonly<{ cell: GridCoord; occupantId: string }>[];
}>;
export type WriteEntityOccupancyResult = WriteEntityOccupancyOk | WriteEntityOccupancyBlocked;

export function createOccupancyMap(): OccupancyMap {
  return new Map();
}

function cellSet(
  map: ReadonlyMap<string, ReadonlySet<string>>,
  cell: GridCoord
): ReadonlySet<string> | undefined {
  return map.get(coordKey(cell));
}

/** 与 oh-gen-doc「包含实体」列表对应的只读视图（按 id 排序，便于快照与测试稳定）。 */
export function getOccupants(
  map: ReadonlyMap<string, ReadonlySet<string>>,
  cell: GridCoord
): readonly string[] {
  const s = cellSet(map, cell);
  if (!s || s.size === 0) return [];
  return [...s].sort();
}

/** 兼容旧调用：返回该格上的代表 id（多实体时取排序后的首个）。 */
export function getOccupant(
  map: ReadonlyMap<string, ReadonlySet<string>>,
  cell: GridCoord
): string | undefined {
  const ids = getOccupants(map, cell);
  return ids.length === 0 ? undefined : ids[0];
}

export function isOccupied(map: ReadonlyMap<string, ReadonlySet<string>>, cell: GridCoord): boolean {
  const s = cellSet(map, cell);
  return s !== undefined && s.size > 0;
}

/** 逻辑格（小人当前格）是否与**其他**小人重叠；用于移动/寻路前的冲突预判。 */
export function isCellOccupiedByOthers(
  logicalCellsByPawnId: ReadonlyMap<string, GridCoord>,
  cell: GridCoord,
  selfPawnId: string
): boolean {
  for (const [id, c] of logicalCellsByPawnId) {
    if (id === selfPawnId) continue;
    if (c.col === cell.col && c.row === cell.row) return true;
  }
  return false;
}

/**
 * 占用一格：空格或已被同一 `entityId` 占用则写入并成功；被其他实体占用则返回冲突且不修改。
 */
export function occupy(map: OccupancyMap, cell: GridCoord, entityId: string): OccupyResult {
  const key = coordKey(cell);
  let set = map.get(key);
  if (!set) {
    map.set(key, new Set([entityId]));
    return { ok: true };
  }
  if (set.has(entityId)) {
    return { ok: true };
  }
  if (set.size === 0) {
    set.add(entityId);
    return { ok: true };
  }
  const occupantId = [...set].sort()[0]!;
  return { ok: false, cell, occupantId };
}

/**
 * 释放占用：从该格集合中移除 `entityId`；集合空则删除格键（幂等）。
 */
export function release(map: OccupancyMap, cell: GridCoord, entityId: string): void {
  const key = coordKey(cell);
  const set = map.get(key);
  if (!set || !set.has(entityId)) return;
  set.delete(entityId);
  if (set.size === 0) map.delete(key);
}

export function checkPlacement(
  map: ReadonlyMap<string, ReadonlySet<string>>,
  cells: readonly GridCoord[],
  options?: Readonly<{ ignoreOccupantId?: string }>
): PlacementCheck {
  const ignore = options?.ignoreOccupantId;
  const entries: CellPlacementEntry[] = [];
  let firstConflict: { cell: GridCoord; occupantId: string } | undefined;

  for (const cell of cells) {
    const ids = getOccupants(map, cell);
    const blockers = ignore ? ids.filter((id) => id !== ignore) : ids;
    if (blockers.length === 0) {
      entries.push({ cell, ok: true });
    } else {
      const occupantId = blockers[0]!;
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
  map: ReadonlyMap<string, ReadonlySet<string>>,
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

/**
 * 批量写入实体占格：先用 {@link checkPlacement}（等同 {@link findBlockingOccupant} 的忽略口径）校验；
 * 任一阻挡格则返回聚合冲突且**不写入**；否则再逐格 `occupy`，避免静默部分成功。
 */
export function writeEntityOccupancy(
  map: OccupancyMap,
  entityId: string,
  occupiedCells: readonly GridCoord[]
): WriteEntityOccupancyResult {
  const check = checkPlacement(map, occupiedCells, { ignoreOccupantId: entityId });
  if (!check.allClear) {
    const conflicts: { cell: GridCoord; occupantId: string }[] = [];
    for (const e of check.entries) {
      if (!e.ok) conflicts.push({ cell: e.cell, occupantId: e.occupantId });
    }
    return { ok: false, conflicts };
  }
  for (const cell of occupiedCells) {
    occupy(map, cell, entityId);
  }
  return { ok: true };
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
