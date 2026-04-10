/**
 * @file blueprint-construction.scenario.test.ts
 * @description 建造蓝图场景的无头回归测试
 */

import { describe, expect, it } from 'vitest';
import { runHeadlessScenario } from '@testing/headless/headless-scenario-runner';
import { blueprintConstructionScenario } from '@testing/scenarios/blueprint-construction.scenario';

describe('blueprintConstructionScenario', () => {
  it('会搬运材料、完成施工，并把蓝图转换为建筑', async () => {
    const result = await runHeadlessScenario(blueprintConstructionScenario);

    // 打印步骤详情便于调试
    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }

    expect(result.status).toBe('passed');
    // 建筑应已创建
    expect(result.finalSnapshot.buildings.some(b => b.defId === 'wall_wood')).toBe(true);
  });
});
