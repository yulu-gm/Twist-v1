/**
 * @file carrying.evaluator.ts
 * @description 携带物处理评估器 — 评估 pawn 是否需要处理当前携带的物品
 * @dependencies ai/work-evaluator.types — WorkEvaluator 接口；
 *               pathfinding — 距离估算和可达性检查；
 *               construction — 蓝图材料检查；
 *               item/item.queries — 存储格查找；
 *               ai/jobs — 搬运工作工厂函数
 * @part-of AI 子系统（features/ai）
 */

import type { WorkEvaluator } from '../work-evaluator.types';
import type { WorkEvaluation } from '../work-types';
import type { Pawn } from '../../pawn/pawn.types';
import type { GameMap } from '../../../world/game-map';
import type { World } from '../../../world/world';
import { ObjectKind, ToilType, ToilState, JobState, cellKey } from '../../../core/types';
import { estimateDistance, isReachable } from '../../pathfinding/path.service';
import { findNearestAcceptingCell } from '../../item/item.queries';
import { createCarryJob } from '../jobs/carry-job';
import { areBlueprintMaterialsDelivered } from '../../construction/construction.helpers';

/**
 * 携带物处理评估器 — 当 pawn 手持物品时寻找放置目标
 *
 * 优先查找需要该材料的蓝图，其次查找存储区
 * 蓝图目标评分：8 - distance * 0.1
 * 存储区目标评分：4 - distance * 0.1
 */
export const resolveCarryingWorkEvaluator: WorkEvaluator = {
  kind: 'resolve_carrying',
  label: 'Resolve Carrying',
  priority: 20,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    const blocked: WorkEvaluation = {
      kind: 'resolve_carrying',
      label: 'Resolve Carrying',
      priority: 20,
      score: -1,
      failureReasonCode: 'no_stockpile_destination',
      failureReasonText: 'No legal destination for carried item',
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
        failureReasonText: 'Not carrying anything',
      };
    }

    // 优先查找需要该材料的蓝图
    const blueprintCandidate = findCarryResolutionBlueprintCandidate(pawn, map, carrying.defId);
    if (blueprintCandidate) {
      const count = Math.min(carrying.count, blueprintCandidate.needed);
      const bpCell = { ...blueprintCandidate.blueprint.cell };
      const bpId = blueprintCandidate.blueprint.id;
      return {
        kind: 'resolve_carrying',
        label: 'Resolve Carrying',
        priority: 20,
        score: 8 - blueprintCandidate.distance * 0.1,
        failureReasonCode: 'none',
        failureReasonText: null,
        detail: bpId,
        jobDefId: 'job_deliver_carried_materials',
        evaluatedAtTick: world.tick,
        createJob: () => createCarryJob(pawn.id, bpCell, count, bpId),
      };
    }

    // 查找存储区目标
    const targetCell = findReachableAcceptingCell(pawn, map, world, carrying.defId, 'stockpile-only')
      ?? findReachableAcceptingCell(pawn, map, world, carrying.defId, 'nearest-compatible');
    if (!targetCell) return blocked;

    const destCell = { ...targetCell };
    const count = carrying.count;
    return {
      kind: 'resolve_carrying',
      label: 'Resolve Carrying',
      priority: 20,
      score: 4 - estimateDistance(pawn.cell, targetCell) * 0.1,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: carrying.defId,
      jobDefId: 'job_store_carried_materials',
      evaluatedAtTick: world.tick,
      createJob: () => createCarryJob(pawn.id, destCell, count),
    };
  },
};

/** 在蓝图中寻找可以消耗当前携带物的目标 */
function findCarryResolutionBlueprintCandidate(
  pawn: Pawn,
  map: GameMap,
  materialDefId: string,
): { blueprint: { id: string; cell: { x: number; y: number } }; needed: number; distance: number } | null {
  const blueprints = map.objects.allOfKind(ObjectKind.Blueprint);
  let bestCandidate: { blueprint: { id: string; cell: { x: number; y: number } }; needed: number; distance: number } | null = null;

  for (const blueprint of blueprints) {
    if (blueprint.destroyed || areBlueprintMaterialsDelivered(blueprint)) continue;
    if (!isReachable(map, pawn.cell, blueprint.cell)) continue;

    for (let i = 0; i < blueprint.materialsRequired.length; i++) {
      const required = blueprint.materialsRequired[i];
      const delivered = blueprint.materialsDelivered[i];
      if (!required || required.defId !== materialDefId || delivered?.defId !== materialDefId) continue;

      const inFlight = getBlueprintMaterialInFlightCount(map, blueprint.id, materialDefId);
      const needed = required.count - (delivered?.count ?? 0) - inFlight;
      if (needed <= 0) continue;

      const distance = estimateDistance(pawn.cell, blueprint.cell);
      if (!bestCandidate || distance < bestCandidate.distance) {
        bestCandidate = {
          blueprint: { id: blueprint.id, cell: blueprint.cell },
          needed,
          distance,
        };
      }

      break;
    }
  }

  return bestCandidate;
}

/** 在存储区中查找可达的接受格子 */
function findReachableAcceptingCell(
  pawn: Pawn,
  map: GameMap,
  world: World,
  defId: string,
  searchScope: 'stockpile-only' | 'nearest-compatible',
) {
  const excludedCells = new Set<string>();

  while (true) {
    const candidate = findNearestAcceptingCell(
      map,
      world.defs,
      pawn.cell,
      defId,
      searchScope,
      {
        excludedCells,
        selectionPreference: 'prefer-existing-stacks',
      },
    );
    if (!candidate) return null;
    if (isReachable(map, pawn.cell, candidate)) {
      return candidate;
    }
    excludedCells.add(cellKey(candidate));
  }
}

/** 获取蓝图材料搬运中的在途数量 */
function getBlueprintMaterialInFlightCount(
  map: GameMap,
  blueprintId: string,
  materialDefId: string,
): number {
  let total = 0;
  const pawns = map.objects.allOfKind(ObjectKind.Pawn);

  for (const pawn of pawns) {
    const job = pawn.ai.currentJob;
    if (!job || job.defId !== 'job_deliver_materials') continue;
    if (job.state === JobState.Done || job.state === JobState.Failed) continue;

    const deliverToil = job.toils.find(toil => toil.type === ToilType.Deliver);
    if (!deliverToil || deliverToil.targetId !== blueprintId) continue;
    if (deliverToil.state === ToilState.Completed || deliverToil.state === ToilState.Failed) continue;

    if (pawn.inventory.carrying?.defId === materialDefId) {
      total += pawn.inventory.carrying.count;
      continue;
    }

    const pickupToil = job.toils.find(toil => toil.type === ToilType.PickUp);
    if (!pickupToil?.targetId) continue;

    const pickupItem = map.objects.getAs(pickupToil.targetId, ObjectKind.Item);
    if (!pickupItem || pickupItem.destroyed || pickupItem.defId !== materialDefId) continue;

    total += Math.max(0, Math.floor((pickupToil.localData.requestedCount as number) ?? 0));
  }

  return total;
}
