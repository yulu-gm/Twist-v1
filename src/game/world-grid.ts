/** world-grid：格子坐标、邻格、边界与默认出生点（与 Phaser 无关）。 */

import type { NeedKind } from "./pawn-state";

export type GridCoord = Readonly<{ col: number; row: number }>;

export type InteractionPointKind = "food" | "bed" | "recreation";

export type InteractionPoint = Readonly<{
  id: string;
  kind: InteractionPointKind;
  cell: GridCoord;
  useDurationSec: number;
  needDelta: Partial<Record<NeedKind, number>>;
}>;

export type ReservationSnapshot = ReadonlyMap<string, string>;

export type WorldGridConfig = Readonly<{
  columns: number;
  rows: number;
  /** 像素，用于把格心换算到世界坐标（相对网格原点左上角）。 */
  cellSizePx: number;
  /** 默认 5 个小人出生格（已在边界内且互不重复）。 */
  defaultSpawnPoints: readonly GridCoord[];
  /** 不可行走格（如石头），键格式同 `coordKey`。 */
  blockedCellKeys?: ReadonlySet<string>;
  /** 固定交互点样板，用于目标驱动原型。 */
  interactionPoints: readonly InteractionPoint[];
}>;

export const DEFAULT_WORLD_GRID: WorldGridConfig = {
  columns: 20,
  rows: 10,
  cellSizePx: 48,
  defaultSpawnPoints: [
    { col: 4, row: 3 },
    { col: 6, row: 3 },
    { col: 8, row: 3 },
    { col: 10, row: 3 },
    { col: 12, row: 3 }
  ],
  interactionPoints: [
    {
      id: "food-1",
      kind: "food",
      cell: { col: 5, row: 7 },
      useDurationSec: 2.4,
      needDelta: { hunger: -55 }
    },
    {
      id: "bed-1",
      kind: "bed",
      cell: { col: 9, row: 7 },
      useDurationSec: 3.6,
      needDelta: { rest: -65 }
    },
    {
      id: "bed-2",
      kind: "bed",
      cell: { col: 10, row: 7 },
      useDurationSec: 3.6,
      needDelta: { rest: -65 }
    },
    {
      id: "recreation-1",
      kind: "recreation",
      cell: { col: 14, row: 6 },
      useDurationSec: 2.8,
      needDelta: { recreation: -50 }
    },
    {
      id: "recreation-2",
      kind: "recreation",
      cell: { col: 15, row: 6 },
      useDurationSec: 2.8,
      needDelta: { recreation: -50 }
    }
  ]
};

export function isInsideGrid(config: WorldGridConfig, cell: GridCoord): boolean {
  return (
    cell.col >= 0 &&
    cell.row >= 0 &&
    cell.col < config.columns &&
    cell.row < config.rows
  );
}

export function cellCenterWorld(
  config: WorldGridConfig,
  cell: GridCoord,
  gridOriginXPx: number,
  gridOriginYPx: number
): Readonly<{ x: number; y: number }> {
  const x = gridOriginXPx + (cell.col + 0.5) * config.cellSizePx;
  const y = gridOriginYPx + (cell.row + 0.5) * config.cellSizePx;
  return { x, y };
}

/** 世界像素坐标落到哪一格；在网格外则 `null`（用于指针拾取）。 */
export function cellAtWorldPixel(
  config: WorldGridConfig,
  gridOriginXPx: number,
  gridOriginYPx: number,
  worldXPx: number,
  worldYPx: number
): GridCoord | null {
  const col = Math.floor((worldXPx - gridOriginXPx) / config.cellSizePx);
  const row = Math.floor((worldYPx - gridOriginYPx) / config.cellSizePx);
  const cell: GridCoord = { col, row };
  if (!isInsideGrid(config, cell)) return null;
  return cell;
}

export function worldPointToCell(
  config: WorldGridConfig,
  worldXPx: number,
  worldYPx: number,
  gridOriginXPx = 0,
  gridOriginYPx = 0
): GridCoord | undefined {
  const localX = worldXPx - gridOriginXPx;
  const localY = worldYPx - gridOriginYPx;
  const cell = {
    col: Math.floor(localX / config.cellSizePx),
    row: Math.floor(localY / config.cellSizePx)
  };
  if (!isInsideGrid(config, cell)) return undefined;
  return cell;
}

const ORTHO_OFFSETS: readonly GridCoord[] = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: -1 }
];

export function orthogonalNeighbors(
  config: WorldGridConfig,
  cell: GridCoord
): GridCoord[] {
  const out: GridCoord[] = [];
  for (const d of ORTHO_OFFSETS) {
    const next = { col: cell.col + d.col, row: cell.row + d.row };
    if (isInsideGrid(config, next)) out.push(next);
  }
  return out;
}

/** [0,1) 随机数，便于测试注入。 */
export type GridRand = () => number;

export function isWalkableCell(config: WorldGridConfig, cell: GridCoord): boolean {
  const blocked = config.blockedCellKeys;
  if (blocked?.has(coordKey(cell))) return false;
  return true;
}

/** 在地图内随机挑选若干格作为阻挡（如石头），不与 `excludeKeys` 重叠。 */
export function pickRandomBlockedCells(
  config: WorldGridConfig,
  count: number,
  excludeKeys: ReadonlySet<string>,
  rng: GridRand
): GridCoord[] {
  const candidates: GridCoord[] = [];
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.columns; col++) {
      const cell: GridCoord = { col, row };
      if (!excludeKeys.has(coordKey(cell))) candidates.push(cell);
    }
  }
  const n = Math.min(Math.max(0, count), candidates.length);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = candidates[i]!;
    const b = candidates[j]!;
    candidates[i] = b;
    candidates[j] = a;
  }
  return candidates.slice(0, n);
}

export function blockedKeysFromCells(cells: readonly GridCoord[]): ReadonlySet<string> {
  return new Set(cells.map((cell) => coordKey(cell)));
}

export function rectCellsInclusive(
  config: WorldGridConfig,
  startCell: GridCoord,
  endCell: GridCoord
): GridCoord[] {
  const minCol = Math.min(startCell.col, endCell.col);
  const maxCol = Math.max(startCell.col, endCell.col);
  const minRow = Math.min(startCell.row, endCell.row);
  const maxRow = Math.max(startCell.row, endCell.row);
  const out: GridCoord[] = [];

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cell = { col, row };
      if (isInsideGrid(config, cell)) out.push(cell);
    }
  }

  return out;
}

export function rectCellKeysInclusive(
  config: WorldGridConfig,
  startCell: GridCoord,
  endCell: GridCoord
): ReadonlySet<string> {
  return new Set(rectCellsInclusive(config, startCell, endCell).map(coordKey));
}

export function coordKey(cell: GridCoord): string {
  return `${cell.col},${cell.row}`;
}

/** 解析 {@link coordKey} 格式；失败时返回 `undefined`。 */
/** 移除已不存在的交互点预订（动态床位 id 变化时避免陈留）。 */
export function pruneReservationSnapshot(
  reservations: ReservationSnapshot,
  validIds: ReadonlySet<string>
): ReservationSnapshot {
  const next = new Map(reservations);
  for (const id of [...next.keys()]) {
    if (!validIds.has(id)) next.delete(id);
  }
  return next;
}

export function parseCoordKey(key: string): GridCoord | undefined {
  const comma = key.indexOf(",");
  if (comma <= 0) return undefined;
  const col = Number(key.slice(0, comma));
  const row = Number(key.slice(comma + 1));
  if (!Number.isInteger(col) || !Number.isInteger(row)) return undefined;
  return { col, row };
}

/**
 * 两格之间的 Bresenham 线段（含端点），用于笔刷拖拽覆盖格集合。
 */
export function gridLineCells(from: GridCoord, to: GridCoord): GridCoord[] {
  let x0 = from.col;
  let y0 = from.row;
  const x1 = to.col;
  const y1 = to.row;
  const out: GridCoord[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    out.push({ col: x0, row: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return out;
}

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

export function createReservationSnapshot(): ReservationSnapshot {
  return new Map();
}

export function reserveInteractionPoint(
  reservations: ReservationSnapshot,
  interactionPointId: string,
  pawnId: string
): ReservationSnapshot | undefined {
  const owner = reservations.get(interactionPointId);
  if (owner && owner !== pawnId) return undefined;
  const next = new Map(reservations);
  next.set(interactionPointId, pawnId);
  return next;
}

export function releaseInteractionPoint(
  reservations: ReservationSnapshot,
  interactionPointId: string,
  pawnId: string
): ReservationSnapshot {
  const owner = reservations.get(interactionPointId);
  if (owner !== pawnId) return reservations;
  const next = new Map(reservations);
  next.delete(interactionPointId);
  return next;
}

export function isInteractionPointReservedByOther(
  reservations: ReservationSnapshot,
  interactionPointId: string,
  pawnId: string
): boolean {
  const owner = reservations.get(interactionPointId);
  return owner !== undefined && owner !== pawnId;
}

export function findInteractionPointById(
  grid: WorldGridConfig,
  interactionPointId: string
): InteractionPoint | undefined {
  return grid.interactionPoints.find((point) => point.id === interactionPointId);
}

export function interactionPointsByKind(
  grid: WorldGridConfig,
  kind: InteractionPointKind
): InteractionPoint[] {
  return grid.interactionPoints.filter((point) => point.kind === kind);
}
