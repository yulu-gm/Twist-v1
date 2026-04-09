/**
 * @file interact.handler.ts
 * @description Interact Toil handler — 与建筑物进行交互（工作台、床铺等）
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ObjectKind, ToilState, cellEquals } from '../../../core/types';
import { log } from '../../../core/logger';
import type { ToilHandler } from './toil-handler.types';

/** 执行交互（Interact）Toil */
export const executeInteract: ToilHandler = ({ pawn, toil, map }) => {
  if (!toil.targetId) {
    toil.state = ToilState.Failed;
    return;
  }

  const building = map.objects.getAs(toil.targetId, ObjectKind.Building);
  if (!building || building.destroyed) {
    toil.state = ToilState.Failed;
    return;
  }

  // 检查 Pawn 是否在建筑的交互格子上
  const interactionCell = building.interaction?.interactionCell ?? building.cell;
  if (!cellEquals(pawn.cell, interactionCell)) {
    toil.state = ToilState.Failed;
    return;
  }

  const ld = toil.localData;
  const interacted = (ld.interacted as number) ?? 0;
  const interactTicks = (ld.interactTicks as number) ?? 30;

  ld.interacted = interacted + 1;

  if ((ld.interacted as number) >= interactTicks) {
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} finished interacting with ${building.defId}`, undefined, pawn.id);
  }
};
