/**
 * @file drop.handler.ts
 * @description Drop Toil handler — Pawn 将携带的物品放置在当前格子
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ToilState } from '../../../core/types';
import { log } from '../../../core/logger';
import { createItemRaw } from '../../item/item.factory';
import type { ToilHandler } from './toil-handler.types';

/** 执行放置（Drop）Toil */
export const executeDrop: ToilHandler = ({ pawn, toil, map }) => {
  if (!pawn.inventory.carrying) {
    log.warn('ai', `Pawn ${pawn.id} has nothing to drop`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  const carriedId = pawn.inventory.carrying;

  // 从 localData 中获取物品定义 ID 和数量（由 PickUp 步骤填充）
  const defId = (toil.localData.defId as string) ?? 'unknown';
  const count = (toil.localData.count as number) ?? 1;

  const item = createItemRaw({
    defId, cell: pawn.cell, mapId: map.id, stackCount: count,
  });

  map.objects.add(item);
  pawn.inventory.carrying = null;

  log.debug('ai', `Pawn ${pawn.id} dropped ${defId} x${count} at (${pawn.cell.x},${pawn.cell.y})`, undefined, pawn.id);
  toil.state = ToilState.Completed;
};
