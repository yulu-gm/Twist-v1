/**
 * @file scenario.types.ts
 * @description Scenario DSL 核心类型定义 — 场景步骤、场景定义和运行结果的类型模型
 * @part-of testing/scenario-dsl — 场景 DSL 层
 */

// ── 步骤类型 ──

/** 步骤种类：动作、等待、断言 */
export type ScenarioStepKind = 'action' | 'waitFor' | 'assert';

/** 步骤执行状态 */
export type ScenarioStepStatus = 'pending' | 'running' | 'passed' | 'failed';

/** 步骤执行时可访问的上下文 */
export interface ScenarioStepContext {
  /** 场景 harness — 提供 world、map、tick 推进等能力 */
  harness: import('../scenario-harness/scenario-harness').ScenarioHarness;
}

/** 步骤基础接口 */
export interface ScenarioStepBase {
  /** 步骤种类 */
  kind: ScenarioStepKind;
  /** 步骤标题 — 业务可读，适合直接展示在 HUD 中 */
  title: string;
  /** 步骤详细说明 */
  detail?: string;
}

/** 动作步骤 — 主动执行一件事 */
export interface ActionStep extends ScenarioStepBase {
  kind: 'action';
  /** 执行函数 */
  run: (context: ScenarioStepContext) => Promise<void> | void;
}

/** 等待步骤 — 等待世界进入某种状态 */
export interface WaitForStep extends ScenarioStepBase {
  kind: 'waitFor';
  /** 条件判断函数 */
  condition: (context: ScenarioStepContext) => boolean;
  /** 最大等待 tick 数 */
  timeoutTicks: number;
  /** 超时时的错误说明 */
  timeoutMessage?: string;
}

/** 断言步骤 — 验证当前状态 */
export interface AssertStep extends ScenarioStepBase {
  kind: 'assert';
  /** 断言函数 */
  assert: (context: ScenarioStepContext) => boolean;
  /** 失败时的上下文描述 */
  failureMessage?: string;
}

/** 任意步骤联合类型 */
export type ScenarioStep = ActionStep | WaitForStep | AssertStep;

// ── 场景定义 ──

/** 场景可视模式的观察说明 */
export interface ScenarioReport {
  /** 建议关注的对象和现象 */
  focus: string;
}

/** 场景定义 — 描述一个完整的业务测试场景 */
export interface ScenarioDefinition {
  /** 场景唯一标识 */
  id: string;
  /** 场景标题 — 业务可读 */
  title: string;
  /** 场景说明 */
  description?: string;
  /** 给人工测试者的观察说明 */
  report?: ScenarioReport;
  /** 初始化步骤 — 搭建世界状态 */
  setup: ActionStep[];
  /** 脚本步骤 — 模拟玩家操作和等待 */
  script: ScenarioStep[];
  /** 最终断言步骤 */
  expect: AssertStep[];
}

// ── 运行结果 ──

/** 单步骤运行结果 */
export interface StepResult {
  /** 步骤标题 */
  title: string;
  /** 步骤种类 */
  kind: ScenarioStepKind;
  /** 执行状态 */
  status: ScenarioStepStatus;
  /** 失败原因 */
  error?: string;
  /** 执行耗费的 tick 数（仅 waitFor 步骤有值） */
  ticksElapsed?: number;
}

/** 场景运行结果 */
export interface ScenarioResult {
  /** 场景 ID */
  scenarioId: string;
  /** 整体状态 */
  status: 'passed' | 'failed';
  /** 所有步骤的结果 */
  steps: StepResult[];
  /** 总耗费的 tick 数 */
  totalTicks: number;
}
