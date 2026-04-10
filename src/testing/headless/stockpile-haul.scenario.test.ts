/**
 * @file stockpile-haul.scenario.test.ts
 * @description 搬运进 Stockpile 场景的无头回归测试
 */

import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { stockpileHaulScenario } from '@testing/scenarios/stockpile-haul.scenario';

describe('stockpileHaulScenario', () => {
  it('会把木材搬运到 stockpile 并放置', async () => {
    const result = await runHeadlessScenario(stockpileHaulScenario);

    // 打印步骤详情便于调试
    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    expect(result.status).toBe('passed');
    // 木材应出现在 stockpile 区域内
    expect(result.finalSnapshot.items.some(item =>
      item.defId === 'wood' && item.cell.x === 16 && item.cell.y === 10,
    )).toBe(true);
  });
});
