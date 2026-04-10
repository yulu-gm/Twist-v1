/**
 * @file drop.handler.ts
 * @description Drop Toil handler — Pawn 将携带的物品放置在当前格子
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

  const stockpileResult = placeItemOnMap({
    map,
    defs: world.defs,
    defId,
    count: Math.min(count, carrying.count),
    preferredCell: target,
    searchScope: 'stockpile-only',
    selectionPreference: 'prefer-existing-stacks',
    noCapacityPolicy: 'fail',
  });

  let remainingCount = stockpileResult.remainingCount;
  let groundedCount = 0;
  let groundedCells = stockpileResult.usedCells.slice();
  if (remainingCount > 0) {
    const spillResult = placeItemOnMap({
      map,
      defs: world.defs,
      defId,
      count: remainingCount,
      preferredCell: pawn.cell,
      searchScope: 'nearest-compatible',
      noCapacityPolicy: 'force-overflow',
    });

    groundedCount = spillResult.placedCount;
    groundedCells = groundedCells.concat(spillResult.usedCells);
    remainingCount = spillResult.remainingCount;

    if (!spillResult.success || spillResult.remainingCount > 0) {
      log.warn('ai', `Pawn ${pawn.id} failed to ground stockpile overflow for ${defId}`, {
        placedCount: spillResult.placedCount,
        remainingCount: spillResult.remainingCount,
        usedFallback: spillResult.usedFallback,
        usedCells: spillResult.usedCells,
      }, pawn.id);
    }
  }

  const placedTotal = stockpileResult.placedCount + groundedCount;
  const carriedRemaining = Math.max(0, carrying.count - placedTotal);
  pawn.inventory.carrying = carriedRemaining > 0 ? { defId, count: carriedRemaining } : null;

  if (remainingCount > 0) {
    toil.state = ToilState.Failed;
    return;
  }

  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;

  const actualCell = stockpileResult.usedCells[0] ?? groundedCells[0] ?? target;
  log.debug('ai', `Pawn ${pawn.id} dropped ${defId} x${placedTotal} at (${actualCell.x},${actualCell.y})`, {
    stockpilePlaced: stockpileResult.placedCount,
    groundedCount,
    usedFallback: stockpileResult.usedFallback || groundedCount > 0,
    usedCells: groundedCells,
  }, pawn.id);
  toil.state = ToilState.Completed;
};
