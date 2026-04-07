/** world-grid：格子坐标、邻格、边界与默认出生点（与 Phaser 无关）。 */

export type GridCoord = Readonly<{ col: number; row: number }>;

export type WorldGridConfig = Readonly<{
  columns: number;
  rows: number;
  /** 像素，用于把格心换算到世界坐标（相对网格原点左上角）。 */
  cellSizePx: number;
  /** 默认 5 个小人出生格（已在边界内且互不重复）。 */
  defaultSpawnPoints: readonly GridCoord[];
  /** 不可行走格（如石头），键格式同 `coordKey`。 */
  blockedCellKeys?: ReadonlySet<string>;
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

/** 从静态阻挡集中移除一格（采矿后岩石已消失，同格地面物资需可走入以便拾取）。 */
export function removeBlockedCellKey(config: WorldGridConfig, cell: GridCoord): void {
  const blocked = config.blockedCellKeys;
  if (!blocked) return;
  const key = coordKey(cell);
  if (blocked instanceof Set) {
    blocked.delete(key);
  }
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

export function gridCoordFromKey(key: string): GridCoord | undefined {
  const comma = key.indexOf(",");
  if (comma <= 0) return undefined;
  const col = Number(key.slice(0, comma));
  const row = Number(key.slice(comma + 1));
  if (!Number.isInteger(col) || !Number.isInteger(row)) return undefined;
  return { col, row };
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
