/**
 * @file scenario-harness.test.ts
 * @description 验证 ScenarioHarness 的核心行为：按顺序执行步骤、等待条件、断言
 */

import { describe, expect, it } from 'vitest';
import {
  createActionStep,
  createAssertStep,
  createScenario,
  createWaitForStep,
} from '@testing/scenario-dsl/scenario.builders';
import { createScenarioHarness } from '@testing/scenario-harness/scenario-harness';

describe('ScenarioHarness', () => {
  it('按顺序执行 action、waitFor、assert，并记录步骤状态', async () => {
    const harness = createScenarioHarness();
    let counter = 0;

    const scenario = createScenario({
      id: 'minimal',
      title: '最小场景',
      setup: [
        createActionStep('初始化计数器', () => {
          counter = 1;
        }),
      ],
      script: [
        createWaitForStep('等待计数器为 1', () => counter === 1, { timeoutTicks: 1 }),
      ],
      expect: [
        createAssertStep('计数器最终为 1', () => counter === 1),
      ],
    });

    const result = await harness.runScenario(scenario);

    expect(result.status).toBe('passed');
    expect(result.steps.map(step => step.status)).toEqual(['passed', 'passed', 'passed']);
  });

  it('waitFor 超时时报告失败', async () => {
    const harness = createScenarioHarness();

    const scenario = createScenario({
      id: 'timeout',
      title: '超时场景',
      setup: [],
      script: [
        createWaitForStep('等待不可能的条件', () => false, {
          timeoutTicks: 3,
          timeoutMessage: '条件永远不会满足',
        }),
      ],
      expect: [],
    });

    const result = await harness.runScenario(scenario);

    expect(result.status).toBe('failed');
    expect(result.steps[0].status).toBe('failed');
    expect(result.steps[0].error).toBe('条件永远不会满足');
    expect(result.steps[0].ticksElapsed).toBe(3);
  });

  it('assert 失败时记录失败并停止后续步骤', async () => {
    const harness = createScenarioHarness();

    const scenario = createScenario({
      id: 'assert-fail',
      title: '断言失败场景',
      setup: [],
      script: [],
      expect: [
        createAssertStep('必定失败', () => false, { failureMessage: '自定义失败消息' }),
        createAssertStep('不应执行', () => true),
      ],
    });

    const result = await harness.runScenario(scenario);

    expect(result.status).toBe('failed');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].error).toBe('自定义失败消息');
  });

  it('createCheckpoint 能正确生成快照', () => {
    const harness = createScenarioHarness();
    const snap = harness.createCheckpoint();

    expect(snap.tick).toBe(0);
    expect(snap.pawns).toEqual([]);
    expect(snap.items).toEqual([]);
  });
});
