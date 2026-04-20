/**
 * @file take-from-storage.handler.ts
 * @description TakeFromStorage Toil handler — pawn 从指定仓库的抽象库存取走一定数量物资到手持栏
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ObjectKind, ToilState, cellEquals, DefId } from '../../../core/types';
import { log } from '../../../core/logger';
import { findPath } from '../../pathfinding/path.service';
import { withdrawFromWarehouse } from '../../storage/storage.service';
import type { ToilHandler } from './toil-handler.types';

/** 执行从仓库取材（TakeFromStorage）Toil */
export const executeTakeFromStorage: ToilHandler = ({ pawn, toil, job, map }) => {
  if (pawn.inventory.carrying) {
    log.warn(
      'ai',
      `Pawn ${pawn.id} TakeFromStorage while already carrying`,
      undefined,
      pawn.id,
    );
    toil.state = ToilState.Failed;
    return;
  }

  const targetId = toil.targetId;
  if (!targetId) {
    toil.state = ToilState.Failed;
    return;
  }

  const warehouse = map.objects.getAs(targetId, ObjectKind.Building);
  if (!warehouse || warehouse.destroyed || !warehouse.storage) {
    log.warn('ai', `Pawn ${pawn.id} TakeFromStorage target ${targetId} invalid`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  // 必须站在仓库交互格上才能取材
  const approachCell = toil.targetCell;
  if (!approachCell) {
    toil.state = ToilState.Failed;
    return;
  }
  if (!cellEquals(pawn.cell, approachCell)) {
    if (!pawn.movement.path || pawn.movement.path.length === 0) {
      const result = findPath(map, pawn.cell, approachCell);
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

  const defId = toil.localData.defId as DefId | undefined;
  const requestedCount = Math.max(0, Math.floor((toil.localData.count as number) ?? 0));
  if (!defId || requestedCount <= 0) {
    toil.state = ToilState.Failed;
    return;
  }

  const cap = pawn.inventory.carryCapacity ?? requestedCount;
  const attempt = Math.min(requestedCount, cap);
  const taken = withdrawFromWarehouse(warehouse, defId, attempt);
  if (taken.takenCount <= 0) {
    log.warn('ai', `Pawn ${pawn.id} TakeFromStorage rejected (empty inventory)`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  pawn.inventory.carrying = { defId, count: taken.takenCount };

  // 把实际取得的数量传播到后续 Deliver/Drop toil（避免它们仍按请求量结算）
  for (let i = job.currentToilIndex + 1; i < job.toils.length; i++) {
    const next = job.toils[i];
    if (next.localData && (next.localData.defId === defId || next.localData.defId === 'unknown')) {
      next.localData.defId = defId;
      next.localData.count = taken.takenCount;
    }
  }

  log.debug(
    'ai',
    `Pawn ${pawn.id} took ${defId} x${taken.takenCount} from ${warehouse.id}`,
    { remainingInWarehouse: warehouse.storage.inventory[defId] ?? 0 },
    pawn.id,
  );
  toil.state = ToilState.Completed;
};
