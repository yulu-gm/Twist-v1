/**
 * @file wait.handler.ts
 * @description Wait Toil handler — 等待指定 tick 数，支持进食恢复
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ToilState } from '../../../core/types';
import { log } from '../../../core/logger';
import type { ToilHandler } from './toil-handler.types';

/** 执行等待（Wait）Toil */
export const executeWait: ToilHandler = ({ pawn, toil }) => {
  const ld = toil.localData;
  const waited = (ld.waited as number) ?? 0;
  const waitTicks = (ld.waitTicks as number) ?? 60;

  ld.waited = waited + 1;

  if ((ld.waited as number) >= waitTicks) {
    // 若此等待是进食的一部分，恢复饱食度
    if (ld.eating) {
      pawn.needs.food = Math.min(100, pawn.needs.food + (ld.nutritionValue as number ?? 30));
      log.debug('ai', `Pawn ${pawn.id} finished eating, food: ${Math.floor(pawn.needs.food)}`, undefined, pawn.id);
    }
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} finished waiting (${waitTicks} ticks)`, undefined, pawn.id);
  }
};
