/**
 * @file adjacent-util.ts
 * @description 邻格查找工具 — 寻找目标格子或 footprint 外围的可通行格子，用于 Pawn 站位
 * @dependencies core/types — CellCoord / Footprint；world/game-map — 地图通行性查询
 * @part-of AI 子系统 / 工作工厂（features/ai/jobs）
 */

import { CellCoord, Footprint, cellKey } from '../../../core/types';
import { GameMap } from '../../../world/game-map';

/** 四方向偏移量：上、下、左、右 */
const ADJACENT_DIRS: CellCoord[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

/**
 * 寻找目标格子四周的一个可通行格子（用于 Pawn 站位）。
 *
 * 适用场景：采矿（矿石格不可通行）、收割（站在旁边收割）、
 * 建造（站在旁边施工）。
 *
 * @param target - 目标格子坐标
 * @param map    - 游戏地图，用于查询通行性
 * @returns 相邻的可通行格子坐标，若四周均不可通行则返回 null
 */
export function findAdjacentPassable(target: CellCoord, map: GameMap): CellCoord | null {
  for (const dir of ADJACENT_DIRS) {
    const nx = target.x + dir.x;
    const ny = target.y + dir.y;
    if (map.pathGrid.isPassable(nx, ny) && map.spatial.isPassable({ x: nx, y: ny })) {
      return { x: nx, y: ny };
    }
  }
  return null;
}

/**
 * 寻找 footprint 外围的一个可通行格子。
 * 对多格建筑，这能确保 pawn 停在 footprint 外，而不是误站进第二格占地。
 */
export function findAdjacentPassableToFootprint(
  origin: CellCoord,
  footprint: Footprint,
  map: GameMap,
): CellCoord | null {
  const candidates: CellCoord[] = [];
  const seen = new Set<string>();

  const pushCandidate = (cell: CellCoord) => {
    const key = cellKey(cell);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(cell);
  };

  for (let dx = 0; dx < footprint.width; dx++) {
    pushCandidate({ x: origin.x + dx, y: origin.y - 1 });
  }
  for (let dx = 0; dx < footprint.width; dx++) {
    pushCandidate({ x: origin.x + dx, y: origin.y + footprint.height });
  }
  for (let dy = 0; dy < footprint.height; dy++) {
    pushCandidate({ x: origin.x - 1, y: origin.y + dy });
  }
  for (let dy = 0; dy < footprint.height; dy++) {
    pushCandidate({ x: origin.x + footprint.width, y: origin.y + dy });
  }

  for (const cell of candidates) {
    if (map.pathGrid.isPassable(cell.x, cell.y) && map.spatial.isPassable(cell)) {
      return cell;
    }
  }

  return null;
}
