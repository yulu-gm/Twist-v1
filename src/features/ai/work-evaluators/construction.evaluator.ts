/**
 * @file construction.evaluator.ts
 * @description 建造类工作评估器 — 材料搬运和建造施工两个工作类别。
 *              本评估器只接受由工作订单（orderKind='build'）派生的 Blueprint / ConstructionSite，
 *              其他渠道（programmatic place_blueprint）创建的 artifact 不在此被选中。
 *              严格优先级：高优先订单的 artifact 优先于低优先订单的 artifact，跨订单不再用距离比较。
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
import type { Blueprint } from '../../construction/blueprint.types';
import type { ConstructionSite } from '../../construction/construction-site.types';
import type { WorkOrder } from '../../work-orders/work-order.types';

const DEFAULT_FOOTPRINT = { width: 1, height: 1 } as const;

/**
 * 收集当前所有 active build 订单（按 priorityIndex 升序）。
 * paused/cancelled 订单一律跳过。
 */
function collectActiveBuildOrders(map: GameMap): WorkOrder[] {
  return map.workOrders
    .list()
    .filter(o => o.orderKind === 'build' && o.status !== 'paused' && o.status !== 'cancelled');
}

/**
 * 把订单 item 解析为对应的 artifact（Blueprint 或 ConstructionSite），
 * 同时回带订单/item id 以便写入 Job。优先取 Blueprint：item 物化后 id 指向 Blueprint，
 * 当 Blueprint 被升级为 ConstructionSite 后，再通过 cell 匹配 site（site 的 workOrderId 也已拷贝过来）。
 */
type BlueprintCandidate = { kind: 'blueprint'; bp: Blueprint; orderId: string; itemId: string };
type SiteCandidate = { kind: 'site'; site: ConstructionSite; orderId: string; itemId: string };

/**
 * 从订单中收集尚未完成的 Blueprint 候选 — 用于 deliver_materials 评估。
 */
function collectBlueprintCandidates(map: GameMap, order: WorkOrder): BlueprintCandidate[] {
  const out: BlueprintCandidate[] = [];
  for (const item of order.items) {
    if (item.status !== 'open' && item.status !== 'claimed' && item.status !== 'working') continue;
    if (!item.artifactId) continue;
    const obj = map.objects.get(item.artifactId);
    if (!obj || obj.destroyed) continue;
    if (obj.kind !== ObjectKind.Blueprint) continue;
    out.push({ kind: 'blueprint', bp: obj as Blueprint, orderId: order.id, itemId: item.id });
  }
  return out;
}

/**
 * 从订单中收集可施工的 Blueprint / ConstructionSite 候选 — 用于 construct 评估。
 * Blueprint 必须已送齐材料；Site 必须未完成。
 */
function collectConstructionCandidates(map: GameMap, order: WorkOrder): Array<BlueprintCandidate | SiteCandidate> {
  const out: Array<BlueprintCandidate | SiteCandidate> = [];
  for (const item of order.items) {
    if (item.status !== 'open' && item.status !== 'claimed' && item.status !== 'working') continue;
    if (!item.artifactId) continue;
    const obj = map.objects.get(item.artifactId);
    if (!obj || obj.destroyed) continue;
    if (obj.kind === ObjectKind.Blueprint) {
      out.push({ kind: 'blueprint', bp: obj as Blueprint, orderId: order.id, itemId: item.id });
    }
  }
  // 同步收集已升级为 ConstructionSite 的对象 — site 通过自身 workOrderId/workOrderItemId 匹配本订单
  for (const site of map.objects.allOfKind(ObjectKind.ConstructionSite)) {
    if (site.destroyed) continue;
    if (site.buildProgress >= 1.0) continue;
    if (site.workOrderId !== order.id) continue;
    out.push({ kind: 'site', site, orderId: order.id, itemId: site.workOrderItemId ?? '' });
  }
  return out;
}

/**
 * 材料搬运评估器 — 只为订单内、尚未送齐材料的 Blueprint 寻找最近的材料源。
 *
 * 评分公式：45 - distance * 0.5（仅在同一订单内的多个 blueprint 之间比较）
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

    const orders = collectActiveBuildOrders(map);

    // 严格优先级：从最高优先订单逐个尝试，第一个能产出有效搬运候选的订单胜出
    for (const order of orders) {
      const candidates = collectBlueprintCandidates(map, order);
      if (candidates.length === 0) continue;

      let bestScore = -Infinity;
      let bestCreateJob: (() => ReturnType<typeof createHaulJob>) | null = null;
      let bestDetail: string | null = null;
      let bestOrderId: string | null = null;
      let bestItemId: string | null = null;

      for (const cand of candidates) {
        const bp = cand.bp;
        if (areBlueprintMaterialsDelivered(bp)) continue;

        // 检查哪些材料仍需搬运
        for (let i = 0; i < bp.materialsRequired.length; i++) {
          const requiredCount = bp.materialsRequired[i].count;
          const deliveredCount = bp.materialsDelivered[i]?.count ?? 0;
          const matDefId = bp.materialsRequired[i].defId;
          const inFlightCount = getBlueprintMaterialInFlightCount(map, bp.id, matDefId);
          const needed = requiredCount - deliveredCount - inFlightCount;
          if (needed <= 0) continue;
          const footprint = bp.footprint ?? DEFAULT_FOOTPRINT;
          const approachCell = findAdjacentPassableToFootprint(bp.cell, footprint, map);
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
              bestOrderId = cand.orderId;
              bestItemId = cand.itemId;
              const itemId = bestItem.id;
              const itemCell = { ...bestItem.cell };
              const bpCell = { ...bp.cell };
              const bpId = bp.id;
              const count = haulCount;
              const targetApproachCell = { ...approachCell };
              bestCreateJob = () => {
                const job = createHaulJob(
                  pawn.id,
                  itemId,
                  itemCell,
                  bpCell,
                  count,
                  bpId,
                  { approachCell: targetApproachCell },
                );
                // deliver_materials job 不直接归属订单 item 的 claim（搬运是中间动作），
                // 但仍写回 workOrderId/workOrderItemId 便于追踪与日后扩展
                if (bestOrderId && bestItemId) {
                  job.workOrderId = bestOrderId;
                  job.workOrderItemId = bestItemId;
                }
                return job;
              };
            }
            break; // 每个蓝图只检查一种缺少的材料
          }
        }
      }

      if (bestCreateJob) {
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
      }
      // 当前订单无可达材料源，按严格优先级仍不允许跨到下一订单 —— 直接报错
      return blocked('no_reachable_material_source', '没有可达的材料来源');
    }

    return blocked('no_target', '没有可送材料的蓝图订单');
  },
};

/**
 * 建造施工评估器 — 只接受属于 build 订单的 Blueprint / ConstructionSite，
 * 对应 deliver 评估器；当订单内有未送齐材料的 Blueprint 时报告 materials_not_delivered。
 *
 * 评分公式：40 - distance * 0.5（仅在同一订单内的多个目标之间比较）
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

    const orders = collectActiveBuildOrders(map);
    let sawAnyOrder = false;
    let sawUndeliveredBlueprint = false;

    for (const order of orders) {
      sawAnyOrder = true;
      const candidates = collectConstructionCandidates(map, order);
      if (candidates.length === 0) continue;

      let bestScore = -Infinity;
      let bestCreateJob: (() => ReturnType<typeof createConstructJob>) | null = null;
      let bestDetail: string | null = null;
      let bestOrderId: string | null = null;
      let bestItemId: string | null = null;
      let orderHasUndelivered = false;

      for (const cand of candidates) {
        if (cand.kind === 'blueprint') {
          const bp = cand.bp;
          if (!areBlueprintMaterialsDelivered(bp)) {
            orderHasUndelivered = true;
            continue;
          }
          if (map.reservations.isReserved(bp.id)) continue;
          if (hasConstructionOccupants(map, bp)) continue;
          const footprint = bp.footprint ?? DEFAULT_FOOTPRINT;
          const approachCell = findAdjacentPassableToFootprint(bp.cell, footprint, map);
          if (!approachCell) continue;

          const dist = estimateDistance(pawn.cell, approachCell);
          const score = 40 - dist * 0.5;
          if (score > bestScore) {
            bestScore = score;
            bestDetail = bp.id;
            bestOrderId = cand.orderId;
            bestItemId = cand.itemId;
            const bpId = bp.id;
            const bpCell = { ...bp.cell };
            const bpFootprint = bp.footprint ?? DEFAULT_FOOTPRINT;
            bestCreateJob = () => {
              const job = createConstructJob(
                pawn.id,
                bpId,
                bpCell,
                map,
                { requiresPrepare: true, targetFootprint: bpFootprint },
              );
              if (bestOrderId && bestItemId) {
                job.workOrderId = bestOrderId;
                job.workOrderItemId = bestItemId;
              }
              return job;
            };
          }
        } else {
          // ConstructionSite 候选
          const site = cand.site;
          if (map.reservations.isReserved(site.id)) continue;
          if (hasConstructionOccupants(map, site)) continue;
          const footprint = site.footprint ?? DEFAULT_FOOTPRINT;
          const approachCell = findAdjacentPassableToFootprint(site.cell, footprint, map);
          if (!approachCell) continue;

          const dist = estimateDistance(pawn.cell, approachCell);
          const score = 40 - dist * 0.5;
          if (score > bestScore) {
            bestScore = score;
            bestDetail = site.id;
            bestOrderId = cand.orderId;
            bestItemId = cand.itemId;
            const siteId = site.id;
            const siteCell = { ...site.cell };
            const siteFootprint = site.footprint ?? DEFAULT_FOOTPRINT;
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
              if (bestOrderId && bestItemId) {
                job.workOrderId = bestOrderId;
                job.workOrderItemId = bestItemId;
              }
              return job;
            };
          }
        }
      }

      if (bestCreateJob) {
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
      }

      // 该订单全是未送齐材料的蓝图 —— 报告 materials_not_delivered，仍不允许跨到下一订单
      if (orderHasUndelivered) {
        sawUndeliveredBlueprint = true;
        return blocked('materials_not_delivered', '材料尚未送达');
      }
      // 否则该订单全部目标都被占用/不可达，继续看下一个订单（这里属于"无法选中"而非"未送齐材料"）
    }

    if (!sawAnyOrder) return blocked('no_target', '没有可施工的建造订单');
    if (sawUndeliveredBlueprint) return blocked('materials_not_delivered', '材料尚未送达');
    return blocked('no_target', '没有可施工目标');
  },
};
