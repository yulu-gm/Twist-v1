/**
 * @file scenario-harness.test.ts
 * @description 验证 ScenarioHarness 的核心行为：按顺序执行步骤、等待条件、断言、上下文分层、别名
 */

import { describe, expect, it } from 'vitest';
import {
  createAssertStep,
  createCommandStep,
  createScenario,
  createSetupStep,
  createWaitForStep,
} from '@testing/scenario-dsl/scenario.builders';
import { createScenarioHarness } from '@testing/scenario-harness/scenario-harness';

describe('ScenarioHarness', () => {
  it('按顺序执行 setup、command、waitFor、assert，并记录步骤状态', async () => {
    const harness = createScenarioHarness();
    let setupRan = false;
    let commandRan = false;

    const scenario = createScenario({
      id: 'context-split',
      title: 'context split',
      setup: [
        createSetupStep('mark setup', ({ harness }) => {
          setupRan = Boolean(harness.map);
        }),
      ],
      script: [
        createCommandStep('mark command', ({ stepTicks }) => {
          stepTicks(1);
          commandRan = true;
        }),
        createWaitForStep('wait for markers', () => setupRan && commandRan, { timeoutTicks: 1 }),
      ],
      expect: [
        createAssertStep('both markers set', () => setupRan && commandRan),
      ],
    });

    const result = await harness.runScenario(scenario);

    expect(result.status).toBe('passed');
    expect(result.steps.map(step => step.status)).toEqual(['passed', 'passed', 'passed', 'passed']);
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

  it('tracks aliases and exposes them through the query api', async () => {
    const harness = createScenarioHarness();
    harness.registerAlias('sourceWood', 'item_1');

    const scenario = createScenario({
      id: 'alias-probe',
      title: 'alias probe',
      setup: [],
      script: [],
      expect: [
        createAssertStep('alias resolves', ({ query }) => query.resolveAlias('sourceWood') === 'item_1'),
      ],
    });

    const result = await harness.runScenario(scenario);
    expect(result.status).toBe('passed');
  });
});
