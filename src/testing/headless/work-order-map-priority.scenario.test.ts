/**
 * @file work-order-map-priority.scenario.test.ts
 * @description 工作订单优先级场景的无头回归测试 — 断言 pawn 按 priorityIndex
 *              先消费高优先订单，并校验 checkpoint 中 workOrders 快照结构与排序。
 */

import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { workOrderMapPriorityScenario } from '@testing/scenarios/work-order-map-priority.scenario';

describe('workOrderMapPriorityScenario', () => {
  it('high-priority order completes before low-priority order', async () => {
    const result = await runHeadlessScenario(workOrderMapPriorityScenario);

    // 打印步骤详情便于调试
    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    expect(result.status).toBe('passed');

    // 工作订单快照中至少存在两张订单，按优先级排序时 "高优先砍树" 在前
    const orders = result.finalSnapshot.workOrders.list;
    expect(orders.length).toBeGreaterThanOrEqual(2);
    expect(orders[0].title).toBe('高优先砍树');

    // 高优先订单已完成至少 1 个 item（树被砍倒）
    const high = result.finalSnapshot.workOrders.byTitle['高优先砍树'];
    expect(high).toBeDefined();
    expect(high.doneItemCount).toBeGreaterThan(0);
  });
});
