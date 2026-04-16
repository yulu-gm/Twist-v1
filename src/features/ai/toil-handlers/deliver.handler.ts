/**
 * @file deliver.handler.ts
 * @description Deliver Toil handler — 移动到目标位置后投放携带物品，支持蓝图材料交付
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ObjectKind, ToilState, cellEquals } from '../../../core/types';
import { log } from '../../../core/logger';
import { findPath } from '../../pathfinding/path.service';
import { placeItemOnMap } from '../../item/item.placement';
import { areBlueprintMaterialsDelivered, tryPromoteBlueprintToConstructionSite } from '../../construction/construction.helpers';
import type { ToilHandler } from './toil-handler.types';

/** 执行交付（Deliver）Toil */
export const executeDeliver: ToilHandler = ({ pawn, toil, map, world }) => {
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
  const carrying = pawn.inventory.carrying;
  if (!carrying) {
    toil.state = ToilState.Completed;
    return;
  }

  const defId = carrying.defId;
  const plannedCount = Math.max(0, Math.floor((toil.localData.count as number) ?? carrying.count));
  let remainingCarried = carrying.count;
  let deliveredCount = 0;

  // 若交付给蓝图，更新蓝图的已交付材料
  if (toil.targetId) {
    const blueprint = map.objects.getAs(toil.targetId, ObjectKind.Blueprint);
    if (blueprint && blueprint.materialsDelivered) {
      for (let i = 0; i < blueprint.materialsDelivered.length; i++) {
        const delivered = blueprint.materialsDelivered[i];
        const required = blueprint.materialsRequired[i];
        if (!required || delivered.defId !== defId || required.defId !== defId) continue;

        const remainingNeed = Math.max(0, required.count - delivered.count);
        deliveredCount = Math.min(remainingCarried, plannedCount, remainingNeed);
        delivered.count += deliveredCount;
        remainingCarried -= deliveredCount;
        break;
      }
    }
  }

  const blueprint = toil.targetId
    ? map.objects.getAs(toil.targetId, ObjectKind.Blueprint)
    : null;

  let fallbackResult = null;
  if (remainingCarried > 0 && !blueprint) {
    fallbackResult = placeItemOnMap({
      map,
      defs: world.defs,
      defId,
      count: remainingCarried,
      preferredCell: pawn.cell,
      searchScope: 'nearest-compatible',
      noCapacityPolicy: 'force-overflow',
    });

    if (!fallbackResult.success || fallbackResult.remainingCount > 0) {
      log.warn('ai', `Pawn ${pawn.id} failed to ground remaining delivered items`, {
        defId,
        remainingCarried,
        placedCount: fallbackResult.placedCount,
        remainingCount: fallbackResult.remainingCount,
        usedFallback: fallbackResult.usedFallback,
        usedCells: fallbackResult.usedCells,
      }, pawn.id);
    }

    remainingCarried = fallbackResult.remainingCount;
  }

  pawn.inventory.carrying = remainingCarried > 0
    ? { defId, count: remainingCarried }
    : null;

  if (!toil.targetId) {
    log.warn('ai', `Pawn ${pawn.id} deliver toil missing blueprint target, grounded carried items instead`, undefined, pawn.id);
  } else if (deliveredCount === 0) {
    log.warn('ai', `Pawn ${pawn.id} could not deliver ${defId} to blueprint ${toil.targetId}, retained carried items instead`, undefined, pawn.id);
  } else {
    if (blueprint && areBlueprintMaterialsDelivered(blueprint)) {
      tryPromoteBlueprintToConstructionSite(world, map, blueprint.id, { ignoreIds: [pawn.id] });
    }
  }

  if (remainingCarried > 0 && !blueprint) {
    toil.state = ToilState.Failed;
    return;
  }

  toil.state = ToilState.Completed;
  log.debug('ai', `Pawn ${pawn.id} delivered ${defId} x${deliveredCount}`, {
    groundedCount: fallbackResult?.placedCount ?? 0,
    groundedCells: fallbackResult?.usedCells ?? [],
  }, pawn.id);
};
