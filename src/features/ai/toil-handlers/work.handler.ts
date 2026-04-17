/**
 * @file work.handler.ts
 * @description Work Toil handler — 累积工作进度，完成后处理采矿/收割/建造结果
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ObjectKind, ToilState } from '../../../core/types';
import { log } from '../../../core/logger';
import { placeItemOnMap } from '../../item/item.placement';
import { hasConstructionOccupants } from '../../construction/construction.helpers';
import type { Designation } from '../../designation/designation.types';
import type { ToilHandler } from './toil-handler.types';

/** 执行工作（Work）Toil */
export const executeWork: ToilHandler = ({ pawn, toil, map, world }) => {
  const ld = toil.localData;
  const workDone = (ld.workDone as number) ?? 0;
  const totalWork = (ld.totalWork as number) ?? 100;
  const constructionTarget = toil.targetId
    ? map.objects.getAs(toil.targetId, ObjectKind.ConstructionSite)
    : undefined;

  if (constructionTarget && hasConstructionOccupants(map, constructionTarget)) {
    return;
  }

  ld.workDone = workDone + 1;

  // 如果正在建造建筑工地，更新工地的施工进度
  if (constructionTarget) {
    constructionTarget.workDone += 1;
    constructionTarget.buildProgress = constructionTarget.workDone / constructionTarget.totalWorkAmount;
  }

  if ((ld.workDone as number) >= totalWork) {
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} finished work toil (${totalWork} work)`, undefined, pawn.id);

    if (toil.targetId) {
      const target = map.objects.get(toil.targetId);
      if (target) {
        // 指派相关工作完成：销毁指派对象
        if (target.kind === ObjectKind.Designation) {
          const desig = target as Designation;

          // 采矿指派：将地形改为泥土地板，并产出石材
          if (desig.designationType === 'mine' && desig.targetCell) {
            const tc = desig.targetCell;
            const terrainDefId = map.terrain.get(tc.x, tc.y);
            const terrainDef = world.defs.terrains.get(terrainDefId);
            if (terrainDef?.mineable) {
              map.terrain.set(tc.x, tc.y, 'dirt');
              map.pathGrid.setPassable(tc.x, tc.y, true);

              if (terrainDef.mineYield) {
                const result = placeItemOnMap({
                  map,
                  defs: world.defs,
                  defId: terrainDef.mineYield.defId,
                  count: terrainDef.mineYield.count,
                  preferredCell: tc,
                  searchScope: 'nearest-compatible',
                  noCapacityPolicy: 'force-overflow',
                });
                if (!result.success || result.remainingCount > 0) {
                  log.warn('ai', `Mine yield placement had remainder at (${tc.x},${tc.y})`, {
                    placedCount: result.placedCount,
                    remainingCount: result.remainingCount,
                    usedFallback: result.usedFallback,
                    usedCells: result.usedCells,
                  }, pawn.id);
                }
              }
            }
          }

          // 收割/砍伐指派：销毁植物并产出收获物
          if ((desig.designationType === 'harvest' || desig.designationType === 'cut') && desig.targetObjectId) {
            const plant = map.objects.get(desig.targetObjectId);
            if (plant && plant.kind === ObjectKind.Plant) {
              const plantDef = world.defs.plants.get(plant.defId);
              if (plantDef?.harvestYield) {
                const result = placeItemOnMap({
                  map,
                  defs: world.defs,
                  defId: plantDef.harvestYield.defId,
                  count: plantDef.harvestYield.count,
                  preferredCell: plant.cell,
                  searchScope: 'nearest-compatible',
                  noCapacityPolicy: 'force-overflow',
                });
                if (!result.success || result.remainingCount > 0) {
                  log.warn('ai', `Harvest yield placement had remainder at (${plant.cell.x},${plant.cell.y})`, {
                    placedCount: result.placedCount,
                    remainingCount: result.remainingCount,
                    usedFallback: result.usedFallback,
                    usedCells: result.usedCells,
                  }, pawn.id);
                }
              }
              plant.destroyed = true;
            }
          }

          target.destroyed = true;
          map.objects.remove(toil.targetId);
          // 若该指派由工作订单派生，回写 item.status = 'done'
          if (desig.workOrderId && desig.workOrderItemId) {
            const order = map.workOrders.get(desig.workOrderId);
            const item = order?.items.find(it => it.id === desig.workOrderItemId);
            if (item) {
              item.status = 'done';
              item.claimedByPawnId = undefined;
              item.currentStage = 'done';
            }
          }
          world.eventBuffer.push({
            type: 'designation_completed',
            tick: world.tick,
            data: { designationId: toil.targetId, pawnId: pawn.id },
          });
        }
      }
    }
  }
};
