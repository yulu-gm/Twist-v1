/**
 * @file woodcutting.scenario.test.ts
 * @description 砍树场景的无头回归测试
 */

import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { woodcuttingScenario } from '@testing/scenarios/woodcutting.scenario';

describe('woodcuttingScenario', () => {
  it('会生成砍树指派、让 pawn 执行工作，并产出木材', async () => {
    const result = await runHeadlessScenario(woodcuttingScenario);

    // 打印步骤详情便于调试
    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    expect(result.status).toBe('passed');
    // 砍树完成后不应有 designation 残留
    expect(result.finalSnapshot.designations).toHaveLength(0);
    // 应该有木材掉落
    expect(result.finalSnapshot.items.some(item => item.defId === 'wood')).toBe(true);
  });
});
