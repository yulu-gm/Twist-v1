/**
 * @file zone-stockpile-lifecycle.scenario.test.ts
 * @description Stockpile 区域生命周期场景的无头回归测试
 */

import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { zoneStockpileLifecycleScenario } from '@testing/scenarios/zone-stockpile-lifecycle.scenario';

describe('zoneStockpileLifecycleScenario', () => {
  it('keeps hauling into valid stockpile cells after expansion and partial removal', async () => {
    const result = await runHeadlessScenario(zoneStockpileLifecycleScenario);

    // 打印步骤详情便于调试
    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    expect(result.status).toBe('passed');
  });
});
