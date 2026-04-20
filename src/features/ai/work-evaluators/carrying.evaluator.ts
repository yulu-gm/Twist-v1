/**
 * @file carrying.evaluator.ts
 * @description 携带物处理评估器 — 评估 pawn 是否需要处理当前携带的物品。
 *              落地路径已统一为仓库抽象库存——不再向地面 stockpile 投放，而是
 *              通过 findReachableWarehouseForDeposit 选取仓库目标，最终 toil 为 StoreInStorage。
 * @dependencies ai/work-evaluator.types — WorkEvaluator 接口；
 *               pathfinding — 距离估算和可达性检查；
 *               construction — 蓝图材料检查；
 *               storage/storage.service — 仓库入库目标查找；
 *               ai/jobs — 搬运工作工厂函数；
 *               blueprint-inflight — 在途材料计算
 * @part-of AI 子系统（features/ai）
 */

import type { WorkEvaluator } from '../work-evaluator.types';
import type { WorkEvaluation } from '../work-types';
import type { Pawn } from '../../pawn/pawn.types';
import type { GameMap } from '../../../world/game-map';
import type { World } from '../../../world/world';
import { ObjectKind } from '../../../core/types';
import { estimateDistance, isReachable } from '../../pathfinding/path.service';
import { findReachableWarehouseForDeposit } from '../../storage/storage.service';
import { createCarryJob } from '../jobs/carry-job';
import { areBlueprintMaterialsDelivered } from '../../construction/construction.helpers';
import { getBlueprintMaterialInFlightCount } from './blueprint-inflight';
import { findAdjacentPassableToFootprint } from '../jobs/adjacent-util';

const DEFAULT_FOOTPRINT = { width: 1, height: 1 } as const;

/**
 * 携带物处理评估器 — 当 pawn 手持物品时寻找放置目标
 *
 * 优先查找需要该材料的蓝图，其次寻找可入库的仓库
 * 蓝图目标评分：8 - distance * 0.1
 * 仓库目标评分：4 - distance * 0.1
 */
export const resolveCarryingWorkEvaluator: WorkEvaluator = {
  kind: 'resolve_carrying',
  label: '处理携带物',
  priority: 20,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    const blocked: WorkEvaluation = {
      kind: 'resolve_carrying',
      label: '处理携带物',
      priority: 20,
      score: -1,
      failureReasonCode: 'no_storage_destination',
      failureReasonText: '当前携带物没有合法仓库存放目标',
      detail: null,
      jobDefId: null,
      evaluatedAtTick: world.tick,
      createJob: null,
    };

    const carrying = pawn.inventory.carrying;
    if (!carrying) {
      return {
        ...blocked,
        failureReasonCode: 'no_target',
        failureReasonText: '当前未携带任何物品',
      };
    }

    // 优先查找需要该材料的蓝图
    const blueprintCandidate = findCarryResolutionBlueprintCandidate(pawn, map, carrying.defId);
    if (blueprintCandidate) {
      const count = Math.min(carrying.count, blueprintCandidate.needed);
      const bpCell = { ...blueprintCandidate.blueprint.cell };
      const bpId = blueprintCandidate.blueprint.id;
      const approachCell = { ...blueprintCandidate.approachCell };
      return {
        kind: 'resolve_carrying',
        label: '处理携带物',
        priority: 20,
        score: 8 - blueprintCandidate.distance * 0.1,
        failureReasonCode: 'none',
        failureReasonText: null,
        detail: bpId,
        jobDefId: 'job_deliver_carried_materials',
        evaluatedAtTick: world.tick,
        createJob: () => createCarryJob(pawn.id, bpCell, count, bpId, { approachCell }),
      };
    }

    // 查找可入库的仓库目标
    const storageCandidate = findReachableWarehouseForDeposit(
      pawn,
      map,
      world,
      carrying.defId,
      carrying.count,
    );
    if (!storageCandidate) return blocked;

    const warehouseId = storageCandidate.warehouse.id;
    const approachCell = { ...storageCandidate.approachCell };
    const count = carrying.count;
    return {
      kind: 'resolve_carrying',
      label: '处理携带物',
      priority: 20,
      score: 4 - storageCandidate.distance * 0.1,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: carrying.defId,
      jobDefId: 'job_store_carried_materials',
      evaluatedAtTick: world.tick,
      createJob: () => createCarryJob(pawn.id, approachCell, count, undefined, { warehouseId, approachCell }),
    };
  },
};

/** 在蓝图中寻找可以消耗当前携带物的目标 */
function findCarryResolutionBlueprintCandidate(
  pawn: Pawn,
  map: GameMap,
  materialDefId: string,
): {
  blueprint: { id: string; cell: { x: number; y: number } };
  needed: number;
  distance: number;
  approachCell: { x: number; y: number };
} | null {
  const blueprints = map.objects.allOfKind(ObjectKind.Blueprint);
  let bestCandidate: {
    blueprint: { id: string; cell: { x: number; y: number } };
    needed: number;
    distance: number;
    approachCell: { x: number; y: number };
  } | null = null;

  for (const blueprint of blueprints) {
    if (blueprint.destroyed || areBlueprintMaterialsDelivered(blueprint)) continue;
    const footprint = blueprint.footprint ?? DEFAULT_FOOTPRINT;
    const approachCell = findAdjacentPassableToFootprint(blueprint.cell, footprint, map);
    if (!approachCell) continue;
    if (!isReachable(map, pawn.cell, approachCell)) continue;

    for (let i = 0; i < blueprint.materialsRequired.length; i++) {
      const required = blueprint.materialsRequired[i];
      const delivered = blueprint.materialsDelivered[i];
      if (!required || required.defId !== materialDefId || delivered?.defId !== materialDefId) continue;

      const inFlight = getBlueprintMaterialInFlightCount(map, blueprint.id, materialDefId);
      const needed = required.count - (delivered?.count ?? 0) - inFlight;
      if (needed <= 0) continue;

      const distance = estimateDistance(pawn.cell, approachCell);
      if (!bestCandidate || distance < bestCandidate.distance) {
        bestCandidate = {
          blueprint: { id: blueprint.id, cell: blueprint.cell },
          needed,
          distance,
          approachCell,
        };
      }

      break;
    }
  }

  return bestCandidate;
}

// ObjectKind 仅用于 blueprint 候选枚举；存储格查找已迁移到仓库服务，无需再用 cellKey/findNearestAcceptingCell。
