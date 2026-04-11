/**
 * @file index.ts
 * @description 工作评估器注册表 — 导出固定顺序的 evaluator 列表
 * @dependencies 各工作类别的 evaluator 实现
 * @part-of AI 子系统（features/ai）
 */

import type { WorkEvaluator } from '../work-evaluator.types';
import { eatWorkEvaluator, sleepWorkEvaluator } from './needs.evaluator';
import { designationMineWorkEvaluator, designationHarvestWorkEvaluator } from './designation.evaluator';
import { deliverMaterialsWorkEvaluator, constructWorkEvaluator } from './construction.evaluator';
import { haulToStockpileWorkEvaluator } from './hauling.evaluator';
import { resolveCarryingWorkEvaluator } from './carrying.evaluator';
import { wanderWorkEvaluator } from './wander.evaluator';

/**
 * 全部工作评估器列表 — 按固定顺序注册
 *
 * selector 会按 priority 和 score 排序评估结果，
 * 但此处的列表顺序决定了评估的调用顺序
 */
export const workEvaluators: WorkEvaluator[] = [
  eatWorkEvaluator,
  sleepWorkEvaluator,
  designationMineWorkEvaluator,
  designationHarvestWorkEvaluator,
  deliverMaterialsWorkEvaluator,
  constructWorkEvaluator,
  haulToStockpileWorkEvaluator,
  resolveCarryingWorkEvaluator,
  wanderWorkEvaluator,
];
