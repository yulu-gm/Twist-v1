/**
 * @file building-probes.ts
 * @description 蓝图和建筑相关的 wait / assert probes — 只读观察建筑状态。
 *              只在 waitFor 和 expect 阶段使用，不修改世界。
 * @dependencies scenario-dsl — 步骤构造器
 * @part-of testing/scenario-probes — 场景观察层
 */

import { createAssertStep, createWaitForStep } from '../scenario-dsl/scenario.builders';
import type { WaitForStep, AssertStep } from '../scenario-dsl/scenario.types';
import type { CellCoord } from '@core/types';

/**
 * 等待蓝图材料全部送达（蓝图不再存在，说明已转为工地）
 *
 * @param title - 步骤标题
 * @param defId - 建筑定义 ID
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForBlueprintDelivered(
  title: string,
  defId: string,
  timeoutTicks = 300,
): WaitForStep {
  return createWaitForStep(title, ({ query }) => {
    const blueprints = query.findBlueprintsByTargetDef(defId);
    // 如果没有蓝图了（已转为工地），说明材料已送达
    return !blueprints.some((bp: any) => bp.targetDefId === defId);
  }, { timeoutTicks, timeoutMessage: `超时：${defId} 的蓝图材料未送达` });
}

/**
 * 等待建筑完成创建
 *
 * @param title - 步骤标题
 * @param defId - 建筑定义 ID
 * @param cell - 期望位置
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForBuildingCreated(
  title: string,
  defId: string,
  cell: CellCoord,
  timeoutTicks = 400,
): WaitForStep {
  return createWaitForStep(title, ({ query }) => query.findBuildingAt(defId, cell) !== null, {
    timeoutTicks,
    timeoutMessage: `超时：${defId} 建筑未在 (${cell.x}, ${cell.y}) 创建`,
  });
}

/**
 * 断言建筑存在于指定位置
 *
 * @param defId - 建筑定义 ID
 * @param cell - 期望位置
 */
export function assertBuildingExists(defId: string, cell: CellCoord): AssertStep {
  return createAssertStep(`${defId} 建筑存在于 (${cell.x}, ${cell.y})`, ({ query }) => {
    return query.findBuildingAt(defId, cell) !== null;
  }, { failureMessage: `${defId} 建筑不存在于 (${cell.x}, ${cell.y})` });
}
