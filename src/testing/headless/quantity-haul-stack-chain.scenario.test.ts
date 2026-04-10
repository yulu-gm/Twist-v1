/**
 * @file quantity-haul-stack-chain.scenario.test.ts
 * @description 数量搬运与堆叠链路场景的无头回归测试
 */

import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { quantityHaulStackChainScenario } from '@testing/scenarios/quantity-haul-stack-chain.scenario';

describe('quantityHaulStackChainScenario', () => {
  it('preserves total item count while hauling and stacking multiple piles into stockpile cells', async () => {
    const result = await runHeadlessScenario(quantityHaulStackChainScenario);

    // 打印步骤详情便于调试
    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    expect(result.status).toBe('passed');
  });
});
