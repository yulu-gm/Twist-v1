/**
 * @file sleep.utils.ts
 * @description 睡眠工作相关的纯工具函数 — 床位占用、睡眠格子选取、棋子瞬移、床位释放
 * @dependencies core/types, world/game-map, features/pawn/pawn.types
 * @part-of features/ai — AI 子系统
 */

import { CellCoord, ObjectKind } from '../../core/types';
import type { GameMap } from '../../world/game-map';
import type { Pawn } from '../pawn/pawn.types';

/** 获取床位占地范围内的所有格子坐标列表 */
function getBedFootprintCells(origin: CellCoord, footprint: { width: number; height: number }): CellCoord[] {
  const cells: CellCoord[] = [];

  for (let dy = 0; dy < footprint.height; dy++) {
    for (let dx = 0; dx < footprint.width; dx++) {
      cells.push({ x: origin.x + dx, y: origin.y + dy });
    }
  }

  return cells;
}

/** 计算两格之间的曼哈顿距离 */
function manhattanDistance(a: CellCoord, b: CellCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 尝试让棋子占用指定床位；若床位已被其他棋子占用则返回 false */
export function claimBedOccupancy(
  map: GameMap,
  pawn: Pawn,
  bedId: string,
): boolean {
  const bed = map.objects.getAs(bedId, ObjectKind.Building);
  if (!bed?.bed || bed.destroyed) return false;

  if (bed.bed.occupantPawnId && bed.bed.occupantPawnId !== pawn.id) {
    return false;
  }

  bed.bed.occupantPawnId = pawn.id;
  return true;
}

/**
 * 获取棋子在床上实际睡觉的格子坐标
 * 优先选取靠近交互格且靠近床位中心的格子；若床位不存在或已销毁则返回 null
 */
export function getBedSleepCell(
  map: GameMap,
  bedId: string,
): CellCoord | null {
  const bed = map.objects.getAs(bedId, ObjectKind.Building);
  if (!bed?.bed || bed.destroyed) return null;

  const footprint = bed.footprint ?? { width: 1, height: 1 };
  const footprintCells = getBedFootprintCells(bed.cell, footprint);
  if (footprintCells.length === 0) return null;

  const interactionCell = bed.interaction?.interactionCell;
  if (!interactionCell) {
    return footprintCells[0];
  }

  const center = {
    x: bed.cell.x + (footprint.width - 1) / 2,
    y: bed.cell.y + (footprint.height - 1) / 2,
  };

  return footprintCells
    .slice()
    .sort((left, right) => {
      const interactionDelta = manhattanDistance(left, interactionCell) - manhattanDistance(right, interactionCell);
      if (interactionDelta !== 0) return interactionDelta;

      const centerDelta = manhattanDistance(left, center) - manhattanDistance(right, center);
      if (centerDelta !== 0) return centerDelta;

      const rowDelta = right.y - left.y;
      if (rowDelta !== 0) return rowDelta;

      return left.x - right.x;
    })[0];
}

/** 将棋子瞬间移动到目标格子，并更新空间索引和移动状态 */
export function movePawnInstantly(
  map: GameMap,
  pawn: Pawn,
  targetCell: CellCoord,
): void {
  const previousCell = { x: pawn.cell.x, y: pawn.cell.y };
  pawn.cell = { x: targetCell.x, y: targetCell.y };
  map.spatial.onObjectMoved(pawn.id, previousCell, pawn.cell, pawn.footprint);
  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;
}

/** 释放棋子当前睡眠工作所占用的床位，使其可被其他棋子使用 */
export function releaseOccupiedBedForPawn(
  map: GameMap | null,
  pawn: Pawn,
): void {
  const job = pawn.ai.currentJob;
  if (!map || !job || job.defId !== 'job_sleep' || !job.targetId) return;

  const bed = map.objects.getAs(job.targetId, ObjectKind.Building);
  if (!bed?.bed) return;
  if (bed.bed.occupantPawnId === pawn.id) {
    bed.bed.occupantPawnId = undefined;
  }
}
