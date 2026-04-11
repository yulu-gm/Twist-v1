/**
 * @file needs.evaluator.ts
 * @description 需求类工作评估器 — 进食和睡眠两个工作类别
 * @dependencies ai/work-evaluator.types — WorkEvaluator 接口；
 *               ai/work-types — WorkEvaluation 类型；
 *               pathfinding — 距离估算；
 *               ai/jobs — 工作工厂函数；
 *               building/building.queries — 床位查询
 * @part-of AI 子系统（features/ai）
 */

import type { WorkEvaluator } from '../work-evaluator.types';
import type { WorkEvaluation } from '../work-types';
import type { Pawn } from '../../pawn/pawn.types';
import type { Item } from '../../item/item.types';
import type { GameMap } from '../../../world/game-map';
import type { World } from '../../../world/world';
import { estimateDistance } from '../../pathfinding/path.service';
import { createEatJob } from '../jobs/eat-job';
import { createSleepJob } from '../jobs/sleep-job';
import { getAllBeds, getBedByOwner, isBedAvailable } from '../../building/building.queries';

/**
 * 进食工作评估器 — 评估 pawn 是否需要并可以进食
 *
 * 评估条件：food 低于 hungerSeekThreshold 时寻找最近的未预留食物
 * 评分公式：100 + hungerUrgency * 200 - distance * 0.5
 */
export const eatWorkEvaluator: WorkEvaluator = {
  kind: 'eat',
  label: 'Eat',
  priority: 100,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    const blocked = (code: 'need_not_triggered' | 'no_target', text: string): WorkEvaluation => ({
      kind: 'eat',
      label: 'Eat',
      priority: 100,
      score: -1,
      failureReasonCode: code,
      failureReasonText: text,
      detail: null,
      jobDefId: null,
      evaluatedAtTick: world.tick,
      createJob: null,
    });

    // 检查是否触发饥饿阈值
    if (pawn.needs.food >= pawn.needsProfile.hungerSeekThreshold) {
      return blocked('need_not_triggered', 'Not hungry enough');
    }

    // 寻找最近的未预留食物
    const items = map.objects.allWithTag('food') as Item[];
    let bestItem: Item | null = null;
    let bestDist = Infinity;
    let hasReservedFood = false;

    for (const item of items) {
      if (item.destroyed) continue;
      if (map.reservations.isReserved(item.id)) {
        hasReservedFood = true;
        continue;
      }

      const dist = estimateDistance(pawn.cell, item.cell);
      if (dist < bestDist) {
        bestDist = dist;
        bestItem = item;
      }
    }

    if (!bestItem) {
      // 如果存在食物但都被预留，报告 target_reserved
      if (hasReservedFood) {
        return blocked('target_reserved', 'All food is reserved');
      }
      return blocked('no_target', 'No food available');
    }

    // 计算进食参数
    const nutritionPerItem = Math.max(1, world.defs.items.get(bestItem.defId)?.nutritionValue ?? 30);
    const missingFood = Math.max(1, pawn.needsProfile.mealTargetFood - pawn.needs.food);
    const requestedCount = Math.min(
      bestItem.stackCount,
      pawn.inventory.carryCapacity,
      Math.max(1, Math.ceil(missingFood / nutritionPerItem)),
    );
    if (requestedCount <= 0) {
      return blocked('no_target', 'No food available');
    }

    const hungerSeekThreshold = Math.max(1, pawn.needsProfile.hungerSeekThreshold);
    const hungerUrgency = (hungerSeekThreshold - pawn.needs.food) / hungerSeekThreshold;
    const score = 100 + hungerUrgency * 200 - bestDist * 0.5;

    // 捕获闭包变量供 createJob 使用
    const foodId = bestItem.id;
    const foodCell = { ...bestItem.cell };
    const totalNutrition = requestedCount * nutritionPerItem;

    return {
      kind: 'eat',
      label: 'Eat',
      priority: 100,
      score,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: bestItem.defId,
      jobDefId: 'job_eat',
      evaluatedAtTick: world.tick,
      createJob: () => createEatJob(pawn.id, foodId, foodCell, requestedCount, totalNutrition),
    };
  },
};

/**
 * 睡眠工作评估器 — 评估 pawn 是否需要并可以睡觉
 *
 * 评估条件：rest 低于 sleepSeekThreshold 时寻找床位或就地休息
 * 评分公式（有床）：90 + sleepUrgency * 140 - distance * 0.5
 * 评分公式（无床）：55 + sleepUrgency * 120
 */
export const sleepWorkEvaluator: WorkEvaluator = {
  kind: 'sleep',
  label: 'Sleep',
  priority: 95,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    // 检查是否触发疲劳阈值
    if (pawn.needs.rest >= pawn.needsProfile.sleepSeekThreshold) {
      return {
        kind: 'sleep',
        label: 'Sleep',
        priority: 95,
        score: -1,
        failureReasonCode: 'need_not_triggered',
        failureReasonText: 'Not tired enough',
        detail: null,
        jobDefId: null,
        evaluatedAtTick: world.tick,
        createJob: null,
      };
    }

    const sleepUrgency = (
      pawn.needsProfile.sleepSeekThreshold - pawn.needs.rest
    ) / Math.max(1, pawn.needsProfile.sleepSeekThreshold);

    // 尝试找到床位
    const ownedBed = getBedByOwner(map, pawn.name);
    const candidateBed = ownedBed && isBedAvailable(ownedBed)
      ? ownedBed
      : findNearestAvailableBed(pawn, map);

    if (candidateBed) {
      const interactionCell = candidateBed.interaction?.interactionCell ?? candidateBed.cell;
      const dist = estimateDistance(pawn.cell, interactionCell);
      const score = 90 + sleepUrgency * 140 - dist * 0.5;
      return {
        kind: 'sleep',
        label: 'Sleep',
        priority: 95,
        score,
        failureReasonCode: 'none',
        failureReasonText: null,
        detail: candidateBed.id,
        jobDefId: 'job_sleep',
        evaluatedAtTick: world.tick,
        createJob: () => createSleepJob(
          pawn.id,
          { bedId: candidateBed.id, interactionCell },
          pawn.cell,
        ),
      };
    }

    // 无床位时就地休息
    const score = 55 + sleepUrgency * 120;
    return {
      kind: 'sleep',
      label: 'Sleep',
      priority: 95,
      score,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: 'floor',
      jobDefId: 'job_sleep',
      evaluatedAtTick: world.tick,
      createJob: () => createSleepJob(pawn.id, null, pawn.cell),
    };
  },
};

/** 查找最近的可用空闲床位 */
function findNearestAvailableBed(pawn: Pawn, map: GameMap) {
  const beds = getAllBeds(map).filter((building) => (
    building.bed?.autoAssignable === true
    && building.bed.ownerPawnId === undefined
    && isBedAvailable(building)
    && !map.reservations.isReserved(building.id)
  ));

  let bestBed = beds[0];
  let bestDistance = Infinity;

  for (const bed of beds) {
    const interactionCell = bed.interaction?.interactionCell ?? bed.cell;
    const dist = estimateDistance(pawn.cell, interactionCell);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestBed = bed;
    }
  }

  return bestBed;
}
