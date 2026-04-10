/**
 * @file eating.scenario.test.ts
 * @description 进食场景的无头回归测试
 */

import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { eatingScenario } from '@testing/scenarios/eating.scenario';

describe('eatingScenario', () => {
  it('会在饥饿时拾取食物并恢复 needs.food', async () => {
    const result = await runHeadlessScenario(eatingScenario);

    // 打印步骤详情便于调试
    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    expect(result.status).toBe('passed');
    // pawn 的饱食度应恢复到至少 30
    expect(result.finalSnapshot.pawns[0].food).toBeGreaterThanOrEqual(30);
  });
});
