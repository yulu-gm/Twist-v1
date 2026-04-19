/**
 * @file drop.handler.ts
 * @description Drop Toil handler — Pawn 将携带的物品放置到当前格附近。
 *              stockpile 已下线，drop 仅作为携带物的兜底落地路径，使用 nearest-compatible 搜索范围。
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ToilState, cellEquals } from '../../../core/types';
import { log } from '../../../core/logger';
import { findPath } from '../../pathfinding/path.service';
import { placeItemOnMap } from '../../item/item.placement';
import type { ToilHandler } from './toil-handler.types';

/** 执行放置（Drop）Toil */
export const executeDrop: ToilHandler = ({ pawn, toil, map, world }) => {
  const carrying = pawn.inventory.carrying;
  if (!carrying) {
    log.warn('ai', `Pawn ${pawn.id} has nothing to drop`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  const target = toil.targetCell;
  if (!target) {
    toil.state = ToilState.Failed;
    return;
  }

  if (!cellEquals(pawn.cell, target)) {
    if (!pawn.movement.path || pawn.movement.path.length === 0) {
      const result = findPath(map, pawn.cell, target);
      if (!result.found) {
        toil.state = ToilState.Failed;
        return;
      }

      pawn.movement.path = result.path;
      pawn.movement.pathIndex = 0;
      pawn.movement.moveProgress = 0;
    }

    return;
  }

  const defId = carrying.defId;
  const count = Math.max(0, Math.floor((toil.localData.count as number) ?? carrying.count));
  if (count <= 0) {
    toil.state = ToilState.Failed;
    return;
  }

  // stockpile 已下线 — 直接尝试就近落地，必要时强制溢出占用。
  const dropResult = placeItemOnMap({
    map,
    defs: world.defs,
    defId,
    count: Math.min(count, carrying.count),
    preferredCell: target,
    searchScope: 'nearest-compatible',
    selectionPreference: 'prefer-existing-stacks',
    noCapacityPolicy: 'force-overflow',
  });

  const placedTotal = dropResult.placedCount;
  const remainingCount = dropResult.remainingCount;
  const carriedRemaining = Math.max(0, carrying.count - placedTotal);
  pawn.inventory.carrying = carriedRemaining > 0 ? { defId, count: carriedRemaining } : null;

  if (remainingCount > 0) {
    log.warn('ai', `Pawn ${pawn.id} failed to ground drop for ${defId}`, {
      placedCount: dropResult.placedCount,
      remainingCount: dropResult.remainingCount,
      usedFallback: dropResult.usedFallback,
      usedCells: dropResult.usedCells,
    }, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;

  const actualCell = dropResult.usedCells[0] ?? target;
  log.debug('ai', `Pawn ${pawn.id} dropped ${defId} x${placedTotal} at (${actualCell.x},${actualCell.y})`, {
    placedCount: dropResult.placedCount,
    usedFallback: dropResult.usedFallback,
    usedCells: dropResult.usedCells,
  }, pawn.id);
  toil.state = ToilState.Completed;
};
