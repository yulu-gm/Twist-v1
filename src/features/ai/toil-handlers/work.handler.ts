/**
 * @file work.handler.ts
 * @description Work Toil handler — 累积工作进度，完成后处理采矿/收割/建造结果
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { ObjectKind, ToilState } from '../../../core/types';
import { log } from '../../../core/logger';
import { createItemRaw } from '../../item/item.factory';
import type { Designation } from '../../designation/designation.types';
import type { ToilHandler } from './toil-handler.types';

/** 执行工作（Work）Toil */
export const executeWork: ToilHandler = ({ pawn, toil, map, world }) => {
  const ld = toil.localData;
  const workDone = (ld.workDone as number) ?? 0;
  const totalWork = (ld.totalWork as number) ?? 100;

  ld.workDone = workDone + 1;

  // 如果正在建造建筑工地，更新工地的施工进度
  if (toil.targetId) {
    const target = map.objects.getAs(toil.targetId, ObjectKind.ConstructionSite);
    if (target) {
      target.workDone += 1;
      target.buildProgress = target.workDone / target.totalWorkAmount;
    }
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
                map.objects.add(createItemRaw({
                  defId: terrainDef.mineYield.defId,
                  cell: tc, mapId: map.id,
                  stackCount: terrainDef.mineYield.count,
                }));
              }
            }
          }

          // 收割/砍伐指派：销毁植物并产出收获物
          if ((desig.designationType === 'harvest' || desig.designationType === 'cut') && desig.targetObjectId) {
            const plant = map.objects.get(desig.targetObjectId);
            if (plant && plant.kind === ObjectKind.Plant) {
              const plantDef = world.defs.plants.get(plant.defId);
              if (plantDef?.harvestYield) {
                map.objects.add(createItemRaw({
                  defId: plantDef.harvestYield.defId,
                  cell: plant.cell, mapId: map.id,
                  stackCount: plantDef.harvestYield.count,
                }));
              }
              plant.destroyed = true;
            }
          }

          target.destroyed = true;
          map.objects.remove(toil.targetId);
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
