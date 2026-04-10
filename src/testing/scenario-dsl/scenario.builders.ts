/**
 * @file scenario.builders.ts
 * @description Scenario DSL 构造器 — 用简洁的工厂函数创建步骤和场景定义
 * @dependencies scenario.types — 步骤和场景类型定义
 * @part-of testing/scenario-dsl — 场景 DSL 层
 */

import type {
  ActionStep,
  WaitForStep,
  AssertStep,
  ScenarioDefinition,
  ScenarioStepContext,
  ScenarioReport,
  ScenarioStep,
} from './scenario.types';

/**
 * 创建动作步骤
 *
 * @param title - 步骤标题（业务可读）
 * @param run - 执行函数
 * @param detail - 可选的详细说明
 */
export function createActionStep(
  title: string,
  run: (context: ScenarioStepContext) => Promise<void> | void,
  detail?: string,
): ActionStep {
  return { kind: 'action', title, detail, run };
}

/**
 * 创建等待步骤
 *
 * @param title - 步骤标题（业务可读）
 * @param condition - 条件判断函数
 * @param options - 配置项
 */
export function createWaitForStep(
  title: string,
  condition: (context: ScenarioStepContext) => boolean,
  options: { timeoutTicks: number; timeoutMessage?: string; detail?: string },
): WaitForStep {
  return {
    kind: 'waitFor',
    title,
    detail: options.detail,
    condition,
    timeoutTicks: options.timeoutTicks,
    timeoutMessage: options.timeoutMessage,
  };
}

/**
 * 创建断言步骤
 *
 * @param title - 步骤标题（业务可读）
 * @param assertFn - 断言函数
 * @param options - 配置项
 */
export function createAssertStep(
  title: string,
  assertFn: (context: ScenarioStepContext) => boolean,
  options?: { failureMessage?: string; detail?: string },
): AssertStep {
  return {
    kind: 'assert',
    title,
    detail: options?.detail,
    assert: assertFn,
    failureMessage: options?.failureMessage,
  };
}

/**
 * 创建场景定义
 *
 * @param config - 场景配置
 */
export function createScenario(config: {
  id: string;
  title: string;
  description?: string;
  report?: ScenarioReport;
  setup: ActionStep[];
  script: ScenarioStep[];
  expect: AssertStep[];
}): ScenarioDefinition {
  return { ...config };
}
