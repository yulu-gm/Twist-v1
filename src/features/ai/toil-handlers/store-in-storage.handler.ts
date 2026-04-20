/**
 * @file store-in-storage.handler.ts
 * @description StoreInStorage Toil handler — 把 pawn 携带物写入指定仓库的抽象库存
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ObjectKind, ToilState, cellEquals } from '../../../core/types';
import { log } from '../../../core/logger';
import { findPath } from '../../pathfinding/path.service';
import { storeInWarehouse } from '../../storage/storage.service';
import type { ToilHandler } from './toil-handler.types';

/** 执行入库（StoreInStorage）Toil */
export const executeStoreInStorage: ToilHandler = ({ pawn, toil, map }) => {
  const carrying = pawn.inventory.carrying;
  if (!carrying) {
    log.warn('ai', `Pawn ${pawn.id} StoreInStorage with empty hands`, undefined, pawn.id);
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
    log.warn('ai', `Pawn ${pawn.id} StoreInStorage target ${targetId} invalid`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  // 必须站在仓库的交互格上才能入库
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

  const requestedCount = Math.max(
    0,
    Math.floor((toil.localData.count as number) ?? carrying.count),
  );
  const attempt = Math.min(requestedCount, carrying.count);
  if (attempt <= 0) {
    toil.state = ToilState.Failed;
    return;
  }

  const stored = storeInWarehouse(warehouse, carrying.defId, attempt);
  if (stored.storedCount <= 0) {
    log.warn('ai', `Pawn ${pawn.id} StoreInStorage rejected (no capacity)`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  const carriedRemaining = carrying.count - stored.storedCount;
  pawn.inventory.carrying = carriedRemaining > 0
    ? { defId: carrying.defId, count: carriedRemaining }
    : null;

  log.debug(
    'ai',
    `Pawn ${pawn.id} stored ${carrying.defId} x${stored.storedCount} into ${warehouse.id}`,
    { carriedRemaining, warehouseStored: warehouse.storage.storedCount },
    pawn.id,
  );

  // 部分入库（仓库满）算失败，留给 cleanup 协议处置剩余携带物
  toil.state = carriedRemaining === 0 ? ToilState.Completed : ToilState.Failed;
};
