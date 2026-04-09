/**
 * @file goto.handler.ts
 * @description GoTo Toil handler — 寻路并移动 Pawn 到目标格子
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ToilState, cellEquals } from '../../../core/types';
import { log } from '../../../core/logger';
import { findPath } from '../../pathfinding/path.service';
import type { ToilHandler } from './toil-handler.types';

/** 执行移动（GoTo）Toil：寻路并移动 Pawn 到目标格子 */
export const executeGoTo: ToilHandler = ({ pawn, toil, map }) => {
  const target = toil.targetCell;
  if (!target) {
    log.warn('ai', `GoTo toil has no targetCell for pawn ${pawn.id}`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  // 检查是否已到达目标
  if (cellEquals(pawn.cell, target)) {
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} arrived at (${target.x},${target.y})`, undefined, pawn.id);
    return;
  }

  // 若尚未设置路径，进行寻路
  if (!pawn.movement.path || pawn.movement.path.length === 0) {
    const result = findPath(map, pawn.cell, target);
    if (!result.found) {
      log.warn('ai', `Pawn ${pawn.id} cannot find path to (${target.x},${target.y})`, undefined, pawn.id);
      toil.state = ToilState.Failed;
      return;
    }
    pawn.movement.path = result.path;
    pawn.movement.pathIndex = 0;
    pawn.movement.moveProgress = 0;
    log.debug('ai', `Pawn ${pawn.id} pathing to (${target.x},${target.y}), ${result.path.length} steps`, undefined, pawn.id);
  }

  // 移动系统负责实际的格子移动，这里只检查是否已到达
  if (cellEquals(pawn.cell, target)) {
    toil.state = ToilState.Completed;
    pawn.movement.path = [];
    pawn.movement.pathIndex = 0;
    pawn.movement.moveProgress = 0;
  }
};
