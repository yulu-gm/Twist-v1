/**
 * @file warehouse-storage-haul.scenario.test.ts
 * @description 仓库入库场景的无头回归测试 — 验证地面物资被搬入仓库并转化为抽象库存
 */

import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { warehouseStorageHaulScenario } from '@testing/scenarios/warehouse-storage-haul.scenario';

describe('warehouseStorageHaulScenario', () => {
  it('把木材搬入仓库后地面清空、抽象库存计数正确', async () => {
    const result = await runHeadlessScenario(warehouseStorageHaulScenario);

    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    expect(result.status).toBe('passed');
    // 地面木材清空
    expect(result.finalSnapshot.items.some(item => item.defId === 'wood')).toBe(false);
  });
});
