/**
 * @file reservation-probes.ts
 * @description Reservation 相关的 wait / assert probes — 只读观察 reservation 状态。
 *              支持通过 alias 引用对象。只在 waitFor 和 expect 阶段使用，不修改世界。
 * @dependencies scenario-dsl — 步骤构造器
 * @part-of testing/scenario-probes — 场景观察层
 */

import { createAssertStep, createWaitForStep } from '../scenario-dsl/scenario.builders';
import type { WaitForStep, AssertStep, ScenarioQueryApi } from '../scenario-dsl/scenario.types';

/**
 * 解析 alias 或直接 ID
 */
function resolveTargetId(query: ScenarioQueryApi, aliasOrId: string): string {
  return query.resolveAlias(aliasOrId) ?? aliasOrId;
}

/**
 * 等待指定对象的 reservation 被释放
 *
 * @param title - 步骤标题
 * @param aliasOrId - 对象 alias 或直接 ID
 * @param timeoutTicks - 最大等待 tick 数
 */
export function waitForReservationReleased(
  title: string,
  aliasOrId: string,
  timeoutTicks = 120,
): WaitForStep {
  return createWaitForStep(title, ({ query }) => {
    const targetId = resolveTargetId(query, aliasOrId);
    return !query.isReserved(targetId);
  }, { timeoutTicks, timeoutMessage: `超时：${aliasOrId} 的 reservation 未释放` });
}

/**
 * 断言指定对象的 reservation 已释放
 *
 * @param aliasOrId - 对象 alias 或直接 ID
 */
export function assertReservationReleased(aliasOrId: string): AssertStep {
  return createAssertStep(`${aliasOrId} reservation 已释放`, ({ query }) => {
    const targetId = resolveTargetId(query, aliasOrId);
    return !query.isReserved(targetId);
  }, { failureMessage: `${aliasOrId} 的 reservation 仍未释放` });
}
