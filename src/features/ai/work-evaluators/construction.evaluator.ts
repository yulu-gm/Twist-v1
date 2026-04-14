/**
 * @file construction.evaluator.ts
 * @description 建造类工作评估器 — 材料搬运和建造施工两个工作类别
 * @dependencies ai/work-evaluator.types — WorkEvaluator 接口；
 *               pathfinding — 距离估算和可达性检查；
 *               construction — 蓝图材料检查和占用检测；
 *               ai/jobs — 工作工厂函数；
 *               blueprint-inflight — 在途材料计算
 * @part-of AI 子系统（features/ai）
 */

import type { WorkEvaluator } from '../work-evaluator.types';
import type { WorkEvaluation } from '../work-types';
import type { Pawn } from '../../pawn/pawn.types';
import type { Item } from '../../item/item.types';
import type { GameMap } from '../../../world/game-map';
import type { World } from '../../../world/world';
import { ObjectKind, ToilType } from '../../../core/types';
import { estimateDistance, isReachable } from '../../pathfinding/path.service';
import { createHaulJob } from '../jobs/haul-job';
import { createConstructJob } from '../jobs/construct-job';
import {
  areBlueprintMaterialsDelivered,
  hasConstructionOccupants,
} from '../../construction/construction.helpers';
import { getBlueprintMaterialInFlightCount } from './blueprint-inflight';
import { findAdjacentPassableToFootprint } from '../jobs/adjacent-util';

/**
 * 材料搬运评估器 — 为未送齐材料的蓝图寻找材料搬运目标
 *
 * 评分公式：45 - distance * 0.5
 */
export const deliverMaterialsWorkEvaluator: WorkEvaluator = {
  kind: 'deliver_materials',
  label: '运送材料',
  priority: 45,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    const blocked = (code: 'no_target' | 'no_reachable_material_source', text: string): WorkEvaluation => ({
      kind: 'deliver_materials',
      label: '运送材料',
      priority: 45,
      score: -1,
      failureReasonCode: code,
      failureReasonText: text,
      detail: null,
      jobDefId: null,
      evaluatedAtTick: world.tick,
      createJob: null,
    });

    const blueprints = map.objects.allOfKind(ObjectKind.Blueprint);
    let bestScore = -Infinity;
    let bestCreateJob: (() => ReturnType<typeof createHaulJob>) | null = null;
    let bestDetail: string | null = null;

    for (const bp of blueprints) {
      if (bp.destroyed) continue;
      if (areBlueprintMaterialsDelivered(bp)) continue;

      // 检查哪些材料仍需搬运
      for (let i = 0; i < bp.materialsRequired.length; i++) {
        const requiredCount = bp.materialsRequired[i].count;
        const deliveredCount = bp.materialsDelivered[i]?.count ?? 0;
        const matDefId = bp.materialsRequired[i].defId;
        const inFlightCount = getBlueprintMaterialInFlightCount(map, bp.id, matDefId);
        const needed = requiredCount - deliveredCount - inFlightCount;
        if (needed <= 0) continue;
        const approachCell = findAdjacentPassableToFootprint(bp.cell, bp.footprint, map);
        if (!approachCell) continue;

        // 寻找距离最近的同类型物品
        const items = map.objects.allOfKind(ObjectKind.Item);
        let bestItem: Item | null = null;
        let bestItemDist = Infinity;

        for (const item of items) {
          if (item.destroyed) continue;
          if (item.defId !== matDefId) continue;
          if (map.reservations.isReserved(item.id)) continue;
          if (!isReachable(map, pawn.cell, item.cell) || !isReachable(map, item.cell, approachCell)) continue;

          const haulCount = Math.min(item.stackCount, needed, pawn.inventory.carryCapacity);
          if (haulCount <= 0) continue;

          const d = estimateDistance(pawn.cell, item.cell);
          if (d < bestItemDist) {
            bestItemDist = d;
            bestItem = item;
          }
        }

        if (bestItem) {
          const haulCount = Math.min(bestItem.stackCount, needed, pawn.inventory.carryCapacity);
          if (haulCount <= 0) continue;

          const score = 45 - bestItemDist * 0.5;
          if (score > bestScore) {
            bestScore = score;
            bestDetail = bp.id;
            const itemId = bestItem.id;
            const itemCell = { ...bestItem.cell };
            const bpCell = { ...bp.cell };
            const bpId = bp.id;
            const count = haulCount;
            const targetApproachCell = { ...approachCell };
            bestCreateJob = () => createHaulJob(
              pawn.id,
              itemId,
              itemCell,
              bpCell,
              count,
              bpId,
              { approachCell: targetApproachCell },
            );
          }
          break; // 每个蓝图只检查一种缺少的材料
        }
      }
    }

    if (!bestCreateJob) {
      return blocked('no_reachable_material_source', '没有可达的材料来源');
    }

    const createJobFn = bestCreateJob;
    return {
      kind: 'deliver_materials',
      label: '运送材料',
      priority: 45,
      score: bestScore,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: bestDetail,
      jobDefId: 'job_deliver_materials',
      evaluatedAtTick: world.tick,
      createJob: createJobFn,
    };
  },
};

/**
 * 建造施工评估器 — 为已送齐材料的蓝图或建造工地执行施工
 *
 * 评分公式：40 - distance * 0.5
 * 当蓝图材料未送齐时报告 materials_not_delivered
 */
export const constructWorkEvaluator: WorkEvaluator = {
  kind: 'construct',
  label: '施工',
  priority: 40,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    const blocked = (code: 'no_target' | 'materials_not_delivered' | 'target_reserved', text: string): WorkEvaluation => ({
      kind: 'construct',
      label: '施工',
      priority: 40,
      score: -1,
      failureReasonCode: code,
      failureReasonText: text,
      detail: null,
      jobDefId: null,
      evaluatedAtTick: world.tick,
      createJob: null,
    });

    let bestScore = -Infinity;
    let bestCreateJob: (() => ReturnType<typeof createConstructJob>) | null = null;
    let bestDetail: string | null = null;
    let hasUndeliveredBlueprint = false;

    // 检查已送齐材料的蓝图
    const blueprints = map.objects.allOfKind(ObjectKind.Blueprint);
    for (const bp of blueprints) {
      if (bp.destroyed) continue;

      if (!areBlueprintMaterialsDelivered(bp)) {
        hasUndeliveredBlueprint = true;
        continue;
      }

      if (map.reservations.isReserved(bp.id)) continue;
      if (hasConstructionOccupants(map, bp)) continue;
      const approachCell = findAdjacentPassableToFootprint(bp.cell, bp.footprint, map);
      if (!approachCell) continue;

      const dist = estimateDistance(pawn.cell, approachCell);
      const score = 40 - dist * 0.5;
      if (score > bestScore) {
        bestScore = score;
        bestDetail = bp.id;
        const bpId = bp.id;
        const bpCell = { ...bp.cell };
        const bpFootprint = { ...bp.footprint };
        bestCreateJob = () => createConstructJob(
          pawn.id,
          bpId,
          bpCell,
          map,
          { requiresPrepare: true, targetFootprint: bpFootprint },
        );
      }
    }

    // 检查建造工地
    const sites = map.objects.allOfKind(ObjectKind.ConstructionSite);
    for (const site of sites) {
      if (site.destroyed) continue;
      if (site.buildProgress >= 1.0) continue;
      if (map.reservations.isReserved(site.id)) continue;
      if (hasConstructionOccupants(map, site)) continue;
      const approachCell = findAdjacentPassableToFootprint(site.cell, site.footprint, map);
      if (!approachCell) continue;

      const dist = estimateDistance(pawn.cell, approachCell);
      const score = 40 - dist * 0.5;
      if (score > bestScore) {
        bestScore = score;
        bestDetail = site.id;
        const siteId = site.id;
        const siteCell = { ...site.cell };
        const siteFootprint = { ...site.footprint };
        const totalWork = site.totalWorkAmount - site.workDone;
        bestCreateJob = () => {
          const job = createConstructJob(
            pawn.id,
            siteId,
            siteCell,
            map,
            { targetFootprint: siteFootprint },
          );
          // 根据工地剩余工作量更新 Work Toil 的 totalWork
          const workToil = job.toils.find(t => t.type === ToilType.Work);
          if (workToil) {
            workToil.localData.totalWork = totalWork;
          }
          return job;
        };
      }
    }

    if (!bestCreateJob) {
      // 如果有未送齐材料的蓝图，报告 materials_not_delivered
      if (hasUndeliveredBlueprint) {
        return blocked('materials_not_delivered', '材料尚未送达');
      }
      return blocked('no_target', '没有可施工目标');
    }

    const createJobFn = bestCreateJob;
    return {
      kind: 'construct',
      label: '施工',
      priority: 40,
      score: bestScore,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: bestDetail,
      jobDefId: 'job_construct',
      evaluatedAtTick: world.tick,
      createJob: createJobFn,
    };
  },
};
