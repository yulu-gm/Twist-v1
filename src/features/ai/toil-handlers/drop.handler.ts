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
  if (!pawn.inventory.carrying) {
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

  // 从 localData 中获取物品定义 ID 和数量（由 PickUp 步骤填充）
  const defId = (toil.localData.defId as string) ?? 'unknown';
  const count = (toil.localData.count as number) ?? 1;

  const result = placeItemOnMap({
    map,
    defs: world.defs,
    defId,
    count,
    preferredCell: target,
    searchScope: 'stockpile-only',
    selectionPreference: 'prefer-existing-stacks',
    noCapacityPolicy: 'fail',
  });
  if (!result.success || result.remainingCount > 0 || result.placedCount !== count) {
    log.warn('ai', `Pawn ${pawn.id} failed to drop ${defId} into stockpile`, {
      placedCount: result.placedCount,
      remainingCount: result.remainingCount,
      usedFallback: result.usedFallback,
      usedCells: result.usedCells,
    }, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  pawn.inventory.carrying = null;
  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;

  const actualCell = result.usedCells[0] ?? target;
  log.debug('ai', `Pawn ${pawn.id} dropped ${defId} x${count} at (${actualCell.x},${actualCell.y})`, {
    usedFallback: result.usedFallback,
    usedCells: result.usedCells,
  }, pawn.id);
  toil.state = ToilState.Completed;
};
