/**
 * @file scenario.builders.ts
 * @description Scenario DSL 构造器 — 用简洁的工厂函数创建步骤和场景定义。
 *              提供 createSetupStep / createCommandStep / createWaitForStep / createAssertStep
 *              四种 builder，分别对应不同职责的上下文。
 * @dependencies scenario.types — 步骤和场景类型定义
 * @part-of testing/scenario-dsl — 场景 DSL 层
 */

import type {
  SetupStep,
  CommandStep,
  WaitForStep,
  AssertStep,
  ScenarioDefinition,
  ScenarioReport,
  ScenarioStep,
  SetupContext,
  CommandContext,
  ProbeContext,
} from './scenario.types';

/**
 * 创建 setup 步骤 — 拿到 SetupContext，可直接操作 harness 搭建世界
 *
 * @param title - 步骤标题（业务可读）
 * @param run - 执行函数
 * @param detail - 可选的详细说明
 */
export function createSetupStep(
  title: string,
  run: (context: SetupContext) => Promise<void> | void,
  detail?: string,
): SetupStep {
  return { kind: 'setup', title, detail, run };
}

/**
 * 创建 command 步骤 — 拿到 CommandContext，只能发正式命令和推进 tick
 *
 * @param title - 步骤标题（业务可读）
 * @param run - 执行函数
 * @param detail - 可选的详细说明
 */
export function createCommandStep(
  title: string,
  run: (context: CommandContext) => Promise<void> | void,
  detail?: string,
): CommandStep {
  return { kind: 'command', title, detail, run };
}

/**
 * 创建等待步骤 — 拿到 ProbeContext，只读观察世界状态
 *
 * @param title - 步骤标题（业务可读）
 * @param condition - 条件判断函数
 * @param options - 配置项
 */
export function createWaitForStep(
  title: string,
  condition: (context: ProbeContext) => boolean,
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
 * 创建断言步骤 — 拿到 ProbeContext，只读观察世界状态
 *
 * @param title - 步骤标题（业务可读）
 * @param assertFn - 断言函数
 * @param options - 配置项
 */
export function createAssertStep(
  title: string,
  assertFn: (context: ProbeContext) => boolean,
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
  setup: SetupStep[];
  script: ScenarioStep[];
  expect: AssertStep[];
}): ScenarioDefinition {
  return { ...config };
}
