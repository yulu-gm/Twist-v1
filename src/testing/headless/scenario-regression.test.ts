/**
 * @file scenario-regression.test.ts
 * @description 统一回归测试集 — 遍历场景注册表中所有场景并依次运行
 */

import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { scenarioRegistry } from '@testing/scenario-registry';

describe('Scenario Regression Suite', () => {
  for (const scenario of scenarioRegistry) {
    it(`[${scenario.id}] ${scenario.title}`, async () => {
      const result = await runHeadlessScenario(scenario);

      // 打印步骤详情便于调试
      for (const step of result.steps) {
        console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
        if (step.error) console.log(`    ERROR: ${step.error}`);
      }

      expect(result.status).toBe('passed');
    });
  }
});
