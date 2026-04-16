/**
 * @file pawn-probes.ts
 * @description Pawn 相关的 wait / assert probes — 只读观察 pawn 状态。
 *              只在 waitFor 和 expect 阶段使用，不修改世界。
 * @dependencies scenario-dsl — 步骤构造器
 * @part-of testing/scenario-probes — 场景观察层
 */

import { createAssertStep, createWaitForStep } from '../scenario-dsl/scenario.builders';
import type { WaitForStep, AssertStep } from '../scenario-dsl/scenario.types';

/**
 * 等待特定 pawn 接到任意工作
 *
 * @param title - 步骤标题
 * @param pawnName - 棋子名字
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForPawnAnyJob(
  title: string,
  pawnName: string,
  timeoutTicks = 100,
): WaitForStep {
  return createWaitForStep(title, ({ query }) => {
    const pawn = query.findPawnByName(pawnName);
    return pawn?.ai?.currentJob !== null;
  }, { timeoutTicks, timeoutMessage: `超时：${pawnName} 未接到任何工作` });
}

/**
 * 等待特定 pawn 切换到指定 jobDefId
 *
 * @param title - 步骤标题
 * @param pawnName - 棋子名字
 * @param jobDefId - 目标 job 定义 ID
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForPawnJobDef(
  title: string,
  pawnName: string,
  jobDefId: string,
  timeoutTicks = 100,
): WaitForStep {
  return createWaitForStep(title, ({ query }) => {
    const pawn = query.findPawnByName(pawnName);
    return pawn?.ai?.currentJob?.defId === jobDefId;
  }, { timeoutTicks, timeoutMessage: `超时：${pawnName} 未切换到 ${jobDefId}` });
}

/**
 * 等待 pawn 饱食度达到最小值
 *
 * @param title - 步骤标题
 * @param pawnName - 棋子名字
 * @param minimum - 最小饱食度
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForPawnFoodAtLeast(
  title: string,
  pawnName: string,
  minimum: number,
  timeoutTicks = 200,
): WaitForStep {
  return createWaitForStep(title, ({ query }) => {
    const pawn = query.findPawnByName(pawnName);
    return (pawn?.needs?.food ?? 0) >= minimum;
  }, { timeoutTicks, timeoutMessage: `超时：${pawnName} 饱食度未达到 ${minimum}` });
}

/**
 * 断言 pawn 饱食度达到最小值
 *
 * @param pawnName - 棋子名字
 * @param minimum - 最小饱食度
 */
export function assertPawnFoodAtLeast(pawnName: string, minimum: number): AssertStep {
  return createAssertStep(`${pawnName} 饱食度 >= ${minimum}`, ({ query }) => {
    const pawn = query.findPawnByName(pawnName);
    return (pawn?.needs?.food ?? 0) >= minimum;
  }, { failureMessage: `${pawnName} 饱食度不足 ${minimum}` });
}

/**
 * 断言 pawn 没有携带任何物品
 *
 * @param pawnName - 棋子名字
 */
export function assertPawnNotCarrying(pawnName: string): AssertStep {
  return createAssertStep(`${pawnName} 不应携带物品`, ({ query }) => {
    const pawn = query.findPawnByName(pawnName);
    return pawn?.inventory.carrying == null;
  }, { failureMessage: `${pawnName} 仍在携带物品` });
}
