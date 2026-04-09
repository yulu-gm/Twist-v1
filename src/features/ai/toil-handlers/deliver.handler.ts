/**
 * @file deliver.handler.ts
 * @description Deliver Toil handler — 移动到目标位置后投放携带物品，支持蓝图材料交付
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ObjectKind, ToilState, cellEquals } from '../../../core/types';
import { log } from '../../../core/logger';
import { findPath } from '../../pathfinding/path.service';
import { createItemRaw } from '../../item/item.factory';
import type { ToilHandler } from './toil-handler.types';

/** 执行交付（Deliver）Toil */
export const executeDeliver: ToilHandler = ({ pawn, toil, map }) => {
  const target = toil.targetCell;
  if (!target) {
    toil.state = ToilState.Failed;
    return;
  }

  // 阶段1：移动到目标位置
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
    return; // 等待移动系统将 Pawn 移动到目标位置
  }

  // 阶段2：在目标位置投放物品
  if (!pawn.inventory.carrying) {
    toil.state = ToilState.Completed;
    return;
  }

  const carriedId = pawn.inventory.carrying;
  const defId = (toil.localData.defId as string) ?? 'unknown';
  const count = (toil.localData.count as number) ?? 1;

  // 若交付给蓝图，更新蓝图的已交付材料
  if (toil.targetId) {
    const blueprint = map.objects.getAs(toil.targetId, ObjectKind.Blueprint);
    if (blueprint && blueprint.materialsDelivered) {
      for (const mat of blueprint.materialsDelivered) {
        if (mat.defId === defId) {
          mat.count += count;
          break;
        }
      }
    }
  } else {
    // 没有蓝图目标，直接放置到地面
    map.objects.add(createItemRaw({
      defId, cell: pawn.cell, mapId: map.id, stackCount: count,
    }));
  }

  pawn.inventory.carrying = null;
  toil.state = ToilState.Completed;
  log.debug('ai', `Pawn ${pawn.id} delivered ${defId} x${count}`, undefined, pawn.id);
};
