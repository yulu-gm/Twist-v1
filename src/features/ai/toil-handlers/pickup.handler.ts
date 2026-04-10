/**
 * @file pickup.handler.ts
 * @description PickUp Toil handler — Pawn 拾取目标物品并从地图移除
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ObjectKind, ToilType, ToilState, cellEquals } from '../../../core/types';
import { log } from '../../../core/logger';
import type { ToilHandler } from './toil-handler.types';

/** 执行拾取（PickUp）Toil */
export const executePickUp: ToilHandler = ({ pawn, toil, job, map }) => {
  if (pawn.inventory.carrying) {
    log.warn('ai', `Pawn ${pawn.id} tried to pick up while already carrying items`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  const targetId = toil.targetId;
  if (!targetId) {
    toil.state = ToilState.Failed;
    return;
  }

  const item = map.objects.getAs(targetId, ObjectKind.Item);
  if (!item || item.destroyed) {
    log.warn('ai', `Pawn ${pawn.id} PickUp target ${targetId} not found`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  // 检查 Pawn 是否在物品所在位置
  if (!cellEquals(pawn.cell, item.cell)) {
    log.warn('ai', `Pawn ${pawn.id} not at item ${targetId} location for pickup`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  const requestedCount = Math.max(
    0,
    Math.floor((toil.localData.requestedCount as number) ?? 0),
  );
  if (requestedCount <= 0) {
    log.warn('ai', `Pawn ${pawn.id} PickUp requestedCount invalid for ${targetId}`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  const pickedCount = Math.min(requestedCount, item.stackCount ?? 1, pawn.inventory.carryCapacity);
  if (pickedCount <= 0) {
    toil.state = ToilState.Failed;
    return;
  }

  // 暂存物品信息，供后续 Drop/Deliver 步骤使用
  toil.localData.pickedDefId = item.defId;
  toil.localData.pickedCount = pickedCount;

  // 拾取：按计划数量拆堆，只有整堆拿走时才移除地图对象
  pawn.inventory.carrying = {
    defId: item.defId,
    count: pickedCount,
  };
  item.stackCount -= pickedCount;
  if (item.stackCount <= 0) {
    map.objects.remove(targetId);
  }

  // 将物品信息传播到后续的 Drop/Deliver 类型 Toil
  for (let i = job.currentToilIndex + 1; i < job.toils.length; i++) {
    const nextToil = job.toils[i];
    if (nextToil.type === ToilType.Drop || nextToil.type === ToilType.Deliver) {
      nextToil.localData.defId = item.defId;
    }
  }

  log.debug('ai', `Pawn ${pawn.id} picked up ${item.defId} x${pickedCount} (${targetId})`, undefined, pawn.id);
  toil.state = ToilState.Completed;
};
