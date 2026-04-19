/**
 * @file designation.evaluator.ts
 * @description 指派类工作评估器 — 采矿和收割两个工作类别。
 *              本评估器只从工作订单（map.workOrders）按 priorityIndex 升序取活，
 *              再通过 item.artifactId 解析到已物化的 Designation 对象生成 Job。
 *              严格优先级：高优先订单存在可用 item 时，绝不会选低优先订单的 item，
 *              即使低优先订单的目标距离更近。
 * @dependencies ai/work-evaluator.types — WorkEvaluator 接口；
 *               pathfinding — 距离估算；
 *               ai/jobs — 工作工厂函数
 * @part-of AI 子系统（features/ai）
 */

import type { WorkEvaluator } from '../work-evaluator.types';
import type { WorkEvaluation } from '../work-types';
import type { Pawn } from '../../pawn/pawn.types';
import type { GameMap } from '../../../world/game-map';
import type { World } from '../../../world/world';
import { ObjectKind, DesignationType } from '../../../core/types';
import { estimateDistance } from '../../pathfinding/path.service';
import { createMineJob } from '../jobs/mine-job';
import { createHarvestJob } from '../jobs/harvest-job';
import type { Job } from '../ai.types';
import type { Designation } from '../../designation/designation.types';
import type { WorkOrder, WorkOrderItem } from '../../work-orders/work-order.types';

/**
 * 采矿指派评估器 — 从订单（orderKind='mine'）按优先级取最近可用的物化指派
 *
 * 评分公式：60 + priorityBonus - distance * 0.5（仅在同一订单内的多个 item 之间比较）
 */
export const designationMineWorkEvaluator: WorkEvaluator = {
  kind: 'designation_mine',
  label: '采矿',
  priority: 50,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    return evaluateDesignation(pawn, map, world, DesignationType.Mine, 'designation_mine', '采矿', 60);
  },
};

/**
 * 收割指派评估器 — 从订单（orderKind='cut'/'harvest'）按优先级取最近可用的物化指派
 *
 * 评分公式：50 + priorityBonus - distance * 0.5（仅在同一订单内的多个 item 之间比较）
 */
export const designationHarvestWorkEvaluator: WorkEvaluator = {
  kind: 'designation_harvest',
  label: '收割',
  priority: 50,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    return evaluateDesignation(pawn, map, world, DesignationType.Harvest, 'designation_harvest', '收割', 50);
  },
};

/**
 * 指派评估通用逻辑 —
 * 1. 收集匹配 orderKind 的活跃订单（按 priorityIndex 升序）。
 * 2. 严格优先级：从优先级最高的订单开始遍历，第一个能产出有效候选 item 的订单
 *    即为最终来源；不再回看更低优先订单。
 * 3. 在选定订单的 items 内按距离评分，取最近一个未预留、artifact 仍存在的 item。
 * 4. 把 workOrderId / workOrderItemId 写到 Job 上，便于 selector 在分配时回写 claimed。
 */
function evaluateDesignation(
  pawn: Pawn,
  map: GameMap,
  world: World,
  targetType: DesignationType,
  kind: string,
  label: string,
  baseScore: number,
): WorkEvaluation {
  const blocked: WorkEvaluation = {
    kind,
    label,
    priority: 50,
    score: -1,
    failureReasonCode: 'no_target',
    failureReasonText: `暂无可用的${label}指派`,
    detail: null,
    jobDefId: null,
    evaluatedAtTick: world.tick,
    createJob: null,
  };

  // 收集本评估器关心的订单类型 — Mine 评估器对应 orderKind='mine'；
  // Harvest 评估器同时接受 'cut' 和 'harvest'（与原行为一致：一个评估器服务两类植物作业）
  const orderKinds: Set<string> = targetType === DesignationType.Mine
    ? new Set(['mine'])
    : new Set(['cut', 'harvest']);

  const activeOrders: WorkOrder[] = map.workOrders
    .list()
    .filter(o => orderKinds.has(o.orderKind) && o.status !== 'paused' && o.status !== 'cancelled');

  // 严格优先级：按 list() 顺序（priorityIndex 升序）逐个订单尝试，
  // 第一个能产出有效 item 的订单即胜出。
  for (const order of activeOrders) {
    const pick = pickBestItemFromOrder(pawn, map, order, baseScore);
    if (!pick) continue;

    const { item, designation, score } = pick;
    const targetCell = designation.targetCell ?? designation.cell;
    const desigId = designation.id;
    const desigType = designation.designationType;
    const cell = { ...targetCell };
    const orderId = order.id;
    const itemId = item.id;

    const createJobFn = (): Job => {
      const job = desigType === DesignationType.Mine
        ? createMineJob(pawn.id, cell, desigId, map)
        : createHarvestJob(pawn.id, desigId, cell, map);
      // 订单溯源：写入 Job 顶层字段，selector/work.handler 据此回写订单 item 状态
      job.workOrderId = orderId;
      job.workOrderItemId = itemId;
      return job;
    };

    return {
      kind,
      label,
      priority: 50,
      score,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: desigId,
      jobDefId: kind === 'designation_mine' ? 'job_mine' : 'job_harvest',
      evaluatedAtTick: world.tick,
      createJob: createJobFn,
    };
  }

  return blocked;
}

/**
 * 从单个订单中挑选距离最优的可执行 item — 评分仅在同一订单内部比较，
 * 不允许跨订单比较以保证严格优先级。
 *
 * @returns 命中时返回 { item, designation, score }；无可用 item 返回 null
 */
function pickBestItemFromOrder(
  pawn: Pawn,
  map: GameMap,
  order: WorkOrder,
  baseScore: number,
): { item: WorkOrderItem; designation: Designation; score: number } | null {
  let bestItem: WorkOrderItem | null = null;
  let bestDesignation: Designation | null = null;
  let bestScore = -Infinity;

  for (const item of order.items) {
    if (item.status !== 'open') continue;
    if (!item.artifactId) continue;

    const obj = map.objects.get(item.artifactId);
    if (!obj || obj.destroyed || obj.kind !== ObjectKind.Designation) continue;
    if (map.reservations.isReserved(obj.id)) continue;

    const desig = obj as Designation;
    const targetCell = desig.targetCell ?? desig.cell;
    const dist = estimateDistance(pawn.cell, targetCell);
    const priorityBonus = (desig.priority ?? 2) * 10;
    const score = baseScore + priorityBonus - dist * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
      bestDesignation = desig;
    }
  }

  if (!bestItem || !bestDesignation) return null;
  return { item: bestItem, designation: bestDesignation, score: bestScore };
}
