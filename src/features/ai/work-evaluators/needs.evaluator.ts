/**
 * @file needs.evaluator.ts
 * @description 需求类工作评估器 — 进食和睡眠两个工作类别
 * @dependencies ai/work-evaluator.types — WorkEvaluator 接口；
 *               ai/work-types — WorkEvaluation 类型；
 *               pathfinding — 距离估算；
 *               ai/jobs — 工作工厂函数；
 *               building/building.queries — 床位查询；
 *               storage/storage.service — 仓库取材候选查询
 * @part-of AI 子系统（features/ai）
 */

import type { WorkEvaluator } from '../work-evaluator.types';
import type { WorkEvaluation } from '../work-types';
import type { Pawn } from '../../pawn/pawn.types';
import type { Item } from '../../item/item.types';
import type { GameMap } from '../../../world/game-map';
import type { World } from '../../../world/world';
import { getTimeOfDayState, isHourWithinWindow } from '../../../core/clock';
import { estimateDistance, isReachable } from '../../pathfinding/path.service';
import { createEatJob, createEatFromWarehouseJob } from '../jobs/eat-job';
import { createSleepJob } from '../jobs/sleep-job';
import { getAllBeds, getBedByOwner, isBedAvailable } from '../../building/building.queries';
import { findReachableWarehouseWithTaggedItem } from '../../storage/storage.service';

/**
 * 进食工作评估器 — 评估 pawn 是否需要并可以进食
 *
 * 评估条件：food 低于 hungerSeekThreshold 时寻找食物
 * 食物来源：地面带 'food' 标签的物品 + 仓库抽象库存中带 'food' 标签的条目；
 *           两者按距离择优。仓库取食改走 GoTo → TakeFromStorage → Wait 链
 * 评分公式：100 + hungerUrgency * 200 - distance * 0.5
 */
export const eatWorkEvaluator: WorkEvaluator = {
  kind: 'eat',
  label: '吃饭',
  priority: 100,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    const blocked = (code: 'need_not_triggered' | 'no_target' | 'target_reserved', text: string): WorkEvaluation => ({
      kind: 'eat',
      label: '吃饭',
      priority: 100,
      score: -1,
      failureReasonCode: code,
      failureReasonText: text,
      detail: null,
      jobDefId: null,
      evaluatedAtTick: world.tick,
      createJob: null,
      onAssigned: null,
    });

    // 检查是否触发饥饿阈值
    if (pawn.needs.food >= pawn.needsProfile.hungerSeekThreshold) {
      return blocked('need_not_triggered', '还不够饿');
    }

    // 1) 扫描地面带 'food' 标签的物品 — 选最近的未预留项
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

    // 2) 仓库取食候选 — 用 carryCapacity 作为请求量上限，避免一次取超过手持容量
    const warehouseCandidate = findReachableWarehouseWithTaggedItem(
      pawn,
      map,
      world,
      'food',
      Math.max(1, pawn.inventory.carryCapacity),
    );

    // 3) 没有任何食物来源
    if (!bestItem && !warehouseCandidate) {
      // 如果存在地面食物但都被预留，报告 target_reserved
      if (hasReservedFood) {
        return blocked('target_reserved', '所有食物都已被预留');
      }
      return blocked('no_target', '没有可用食物');
    }

    // 4) 在两条路径里挑距离更近者；并列时优先地面（避免对仓库的高频 withdraw）
    const useWarehouse =
      !bestItem
      || (warehouseCandidate !== null && warehouseCandidate.distance < bestDist);

    if (useWarehouse && warehouseCandidate) {
      const foodDef = world.defs.items.get(warehouseCandidate.defId);
      const nutritionPerItem = Math.max(1, foodDef?.nutritionValue ?? 30);
      const missingFood = Math.max(1, pawn.needsProfile.mealTargetFood - pawn.needs.food);
      const requestedCount = Math.min(
        warehouseCandidate.availableCount,
        pawn.inventory.carryCapacity,
        Math.max(1, Math.ceil(missingFood / nutritionPerItem)),
      );
      if (requestedCount <= 0) {
        return blocked('no_target', '没有可用食物');
      }

      const hungerSeekThreshold = Math.max(1, pawn.needsProfile.hungerSeekThreshold);
      const hungerUrgency = (hungerSeekThreshold - pawn.needs.food) / hungerSeekThreshold;
      const score = 100 + hungerUrgency * 200 - warehouseCandidate.distance * 0.5;

      // 捕获闭包变量供 createJob 使用
      const warehouseId = warehouseCandidate.warehouse.id;
      const approachCell = { ...warehouseCandidate.approachCell };
      const defId = warehouseCandidate.defId;
      const totalNutrition = requestedCount * nutritionPerItem;

      return {
        kind: 'eat',
        label: '吃饭',
        priority: 100,
        score,
        failureReasonCode: 'none',
        failureReasonText: null,
        detail: defId,
        jobDefId: 'job_eat',
        evaluatedAtTick: world.tick,
        createJob: () => createEatFromWarehouseJob(
          pawn.id,
          warehouseId,
          approachCell,
          defId,
          requestedCount,
          totalNutrition,
        ),
        onAssigned: null,
      };
    }

    // 5) 走地面取食路径（保留原行为）
    const foodItem = bestItem!;
    const nutritionPerItem = Math.max(1, world.defs.items.get(foodItem.defId)?.nutritionValue ?? 30);
    const missingFood = Math.max(1, pawn.needsProfile.mealTargetFood - pawn.needs.food);
    const requestedCount = Math.min(
      foodItem.stackCount,
      pawn.inventory.carryCapacity,
      Math.max(1, Math.ceil(missingFood / nutritionPerItem)),
    );
    if (requestedCount <= 0) {
      return blocked('no_target', '没有可用食物');
    }

    const hungerSeekThreshold = Math.max(1, pawn.needsProfile.hungerSeekThreshold);
    const hungerUrgency = (hungerSeekThreshold - pawn.needs.food) / hungerSeekThreshold;
    const score = 100 + hungerUrgency * 200 - bestDist * 0.5;

    // 捕获闭包变量供 createJob 使用
    const foodId = foodItem.id;
    const foodCell = { ...foodItem.cell };
    const totalNutrition = requestedCount * nutritionPerItem;

    return {
      kind: 'eat',
      label: '吃饭',
      priority: 100,
      score,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: foodItem.defId,
      jobDefId: 'job_eat',
      evaluatedAtTick: world.tick,
      createJob: () => createEatJob(pawn.id, foodId, foodCell, requestedCount, totalNutrition),
      onAssigned: null,
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
  label: '睡觉',
  priority: 95,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    // 检查是否触发疲劳阈值
    const tod = getTimeOfDayState(world.clock);
    const sleepSeekThreshold = Math.max(1, pawn.needsProfile.sleepSeekThreshold);
    const restPressure = (sleepSeekThreshold - pawn.needs.rest) / sleepSeekThreshold;
    const inSleepWindow = isHourWithinWindow(
      tod.hourFloat,
      pawn.chronotype.sleepStartHour,
      pawn.chronotype.sleepEndHour,
    );
    const hoursUntilSleepStart = (
      ((pawn.chronotype.sleepStartHour % 24) - tod.hourFloat + 24) % 24
    );
    const schedulePressure = inSleepWindow
      ? 0.75
      : hoursUntilSleepStart <= 1
        ? 0.35
        : hoursUntilSleepStart <= 2
          ? 0.15
          : 0;
    const nightPressure = tod.isNight ? 0.7 : tod.timeSegment === 'dusk' ? 0.25 : 0;
    const sleepUrgency = Math.max(
      0,
      restPressure + schedulePressure + nightPressure + pawn.chronotype.nightOwlBias,
    );

    if (sleepUrgency <= 0) {
      return {
        kind: 'sleep',
        label: '睡觉',
        priority: 95,
        score: -1,
        failureReasonCode: 'need_not_triggered',
        failureReasonText: '还不够困',
        detail: null,
        jobDefId: null,
        evaluatedAtTick: world.tick,
        createJob: null,
        onAssigned: null,
      };
    }


    // 尝试找到 pawn 自己拥有的床位
    const ownedBed = getBedByOwner(map, pawn.name);

    if (ownedBed && isBedAvailable(ownedBed)) {
      const interactionCell = ownedBed.interaction?.interactionCell ?? ownedBed.cell;
      // 检查床位是否可达，不可达时退化为地铺
      if (isReachable(map, pawn.cell, interactionCell)) {
        const dist = estimateDistance(pawn.cell, interactionCell);
        const score = 90 + sleepUrgency * 140 - dist * 0.5;
        return {
          kind: 'sleep',
          label: '睡觉',
          priority: 95,
          score,
          failureReasonCode: 'none',
          failureReasonText: null,
          detail: ownedBed.id,
          jobDefId: 'job_sleep',
          evaluatedAtTick: world.tick,
          createJob: () => createSleepJob(
            pawn.id,
            { bedId: ownedBed.id, interactionCell },
            pawn.cell,
          ),
          onAssigned: null,
        };
      }
    }

    // 无可用自有床位时，尝试认领一张无主空床
    let claimableBedId: string | null = null;
    let claimableInteractionCell = pawn.cell;
    let claimableDistance = Infinity;

    for (const bed of getAllBeds(map)) {
      if (!bed.bed || bed.destroyed) continue;
      if (!bed.bed.autoAssignable || bed.bed.ownerPawnId) continue;
      if (!isBedAvailable(bed) || map.reservations.isReserved(bed.id)) continue;

      const interactionCell = bed.interaction?.interactionCell ?? bed.cell;
      if (!isReachable(map, pawn.cell, interactionCell)) continue;

      const dist = estimateDistance(pawn.cell, interactionCell);
      if (dist < claimableDistance) {
        claimableBedId = bed.id;
        claimableInteractionCell = interactionCell;
        claimableDistance = dist;
      }
    }

    if (claimableBedId) {
      const bedId = claimableBedId;
      const interactionCell = { ...claimableInteractionCell };
      const score = 90 + sleepUrgency * 140 - claimableDistance * 0.5;

      return {
        kind: 'sleep',
        label: '睡觉',
        priority: 95,
        score,
        failureReasonCode: 'none',
        failureReasonText: null,
        detail: bedId,
        jobDefId: 'job_sleep',
        evaluatedAtTick: world.tick,
        createJob: () => createSleepJob(
          pawn.id,
          { bedId, interactionCell },
          pawn.cell,
        ),
        onAssigned: () => {
          const claimedBed = getAllBeds(map).find(bed => bed.id === bedId);
          if (claimedBed?.bed && !claimedBed.bed.ownerPawnId) {
            claimedBed.bed.ownerPawnId = pawn.name;
          }
        },
      };
    }

    // 没有空床时就地休息
    const score = 55 + sleepUrgency * 120;
    return {
      kind: 'sleep',
      label: '睡觉',
      priority: 95,
      score,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: 'floor',
      jobDefId: 'job_sleep',
      evaluatedAtTick: world.tick,
      createJob: () => createSleepJob(pawn.id, null, pawn.cell),
      onAssigned: null,
    };
  },
};
