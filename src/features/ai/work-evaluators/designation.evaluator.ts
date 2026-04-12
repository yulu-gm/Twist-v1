/**
 * @file designation.evaluator.ts
 * @description 指派类工作评估器 — 采矿和收割两个工作类别
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

/**
 * 采矿指派评估器 — 评估是否有可执行的采矿指派
 *
 * 评分公式：60 + priorityBonus - distance * 0.5
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
 * 收割指派评估器 — 评估是否有可执行的收割/砍伐指派
 *
 * 评分公式：50 + priorityBonus - distance * 0.5
 */
export const designationHarvestWorkEvaluator: WorkEvaluator = {
  kind: 'designation_harvest',
  label: '收割',
  priority: 50,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    return evaluateDesignation(pawn, map, world, DesignationType.Harvest, 'designation_harvest', '收割', 50);
  },
};

/** 指派评估通用逻辑 — 查找最近的未预留指派并生成候选 */
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

  const designations = map.objects.allOfKind(ObjectKind.Designation);
  let bestJob: (() => Job) | null = null;
  let bestScore = -Infinity;
  let bestDetail: string | null = null;

  for (const desig of designations) {
    if (desig.destroyed) continue;
    if (map.reservations.isReserved(desig.id)) continue;

    // 匹配目标类型（Harvest 也匹配 Cut）
    const matches = targetType === DesignationType.Mine
      ? desig.designationType === DesignationType.Mine
      : (desig.designationType === DesignationType.Harvest || desig.designationType === DesignationType.Cut);
    if (!matches) continue;

    const targetCell = desig.targetCell ?? desig.cell;
    const dist = estimateDistance(pawn.cell, targetCell);
    const priorityBonus = (desig.priority ?? 2) * 10;
    const score = baseScore + priorityBonus - dist * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestDetail = desig.id;
      const desigId = desig.id;
      const desigType = desig.designationType;
      const cell = { ...targetCell };

      bestJob = () => {
        if (desigType === DesignationType.Mine) {
          return createMineJob(pawn.id, cell, desigId, map);
        }
        return createHarvestJob(pawn.id, desigId, cell, map);
      };
    }
  }

  if (!bestJob) return blocked;

  const createJobFn = bestJob;
  return {
    kind,
    label,
    priority: 50,
    score: bestScore,
    failureReasonCode: 'none',
    failureReasonText: null,
    detail: bestDetail,
    jobDefId: kind === 'designation_mine' ? 'job_mine' : 'job_harvest',
    evaluatedAtTick: world.tick,
    createJob: createJobFn,
  };
}
