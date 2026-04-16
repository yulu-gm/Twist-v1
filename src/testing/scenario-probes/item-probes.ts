/**
 * @file item-probes.ts
 * @description Item 相关的 wait / assert probes — 只读观察物品状态。
 *              只在 waitFor 和 expect 阶段使用，不修改世界。
 * @dependencies scenario-dsl — 步骤构造器
 * @part-of testing/scenario-probes — 场景观察层
 */

import { createAssertStep, createWaitForStep } from '../scenario-dsl/scenario.builders';
import type { WaitForStep, AssertStep } from '../scenario-dsl/scenario.types';
import type { CellCoord } from '@core/types';

/**
 * 等待物品出现在指定位置
 *
 * @param title - 步骤标题
 * @param defId - 物品定义 ID
 * @param cell - 目标位置
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForItemAt(
  title: string,
  defId: string,
  cell: CellCoord,
  timeoutTicks = 200,
): WaitForStep {
  return createWaitForStep(title, ({ query }) => query.findItemAt(defId, cell) !== null, {
    timeoutTicks,
    timeoutMessage: `超时：${defId} 未出现在 (${cell.x}, ${cell.y})`,
  });
}

/**
 * 等待指定位置没有植物（树已被砍倒）
 *
 * @param title - 步骤标题
 * @param cell - 目标位置
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForNoPlantAt(
  title: string,
  cell: CellCoord,
  timeoutTicks = 200,
): WaitForStep {
  return createWaitForStep(title, ({ query }) => query.findPlantAt(cell) === null, {
    timeoutTicks,
    timeoutMessage: `超时：在 (${cell.x}, ${cell.y}) 的树仍未被砍倒`,
  });
}

/**
 * 断言指定位置附近有木材掉落
 *
 * @param cell - 期望掉落位置
 */
export function assertWoodDropped(cell: CellCoord): AssertStep {
  return createAssertStep(`期待木材出现在 (${cell.x}, ${cell.y}) 附近`, ({ query }) => {
    return query.findItemsByDef('wood').some(item => {
      return Math.abs(item.cell.x - cell.x) <= 3 && Math.abs(item.cell.y - cell.y) <= 3;
    });
  }, { failureMessage: `在 (${cell.x}, ${cell.y}) 附近未发现木材` });
}

/**
 * 断言物品不在指定位置
 *
 * @param defId - 物品定义 ID
 * @param cell - 目标位置
 */
export function assertNoItemAt(defId: string, cell: CellCoord): AssertStep {
  return createAssertStep(`${defId} 不应位于 (${cell.x}, ${cell.y})`, ({ query }) => {
    return query.findItemAt(defId, cell) === null;
  }, { failureMessage: `${defId} 仍在 (${cell.x}, ${cell.y})` });
}

/**
 * 断言目标格中指定物品的总数等于期望值
 *
 * @param defId - 物品定义 ID
 * @param cells - 目标格列表
 * @param expected - 期望总数
 */
export function assertTotalItemCountInCells(
  defId: string,
  cells: CellCoord[],
  expected: number,
): AssertStep {
  return createAssertStep(`${defId} 在目标格中的总数为 ${expected}`, ({ query }) => {
    return query.totalItemCountInCells(defId, cells) === expected;
  }, { failureMessage: `${defId} 总数不等于 ${expected}` });
}

/**
 * 断言目标格中至少有一个堆叠数量达到指定最小值
 *
 * @param defId - 物品定义 ID
 * @param cells - 目标格列表
 * @param minimum - 最小堆叠数
 */
export function assertAnyItemStackAtLeast(
  defId: string,
  cells: CellCoord[],
  minimum: number,
): AssertStep {
  return createAssertStep(`${defId} 至少有一个堆叠 >= ${minimum}`, ({ query }) => {
    return cells.some(cell => {
      const item = query.findItemAt(defId, cell);
      return (item?.stackCount ?? 0) >= minimum;
    });
  }, { failureMessage: `${defId} 没有堆叠达到 ${minimum}` });
}
