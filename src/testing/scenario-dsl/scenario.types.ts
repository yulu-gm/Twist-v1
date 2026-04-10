/**
 * @file scenario.types.ts
 * @description Scenario DSL 核心类型定义 — 场景步骤、场景定义和运行结果的类型模型
 *              步骤上下文按职责分为 SetupContext / CommandContext / ProbeContext，
 *              确保 fixture 只能造局、command 只能发命令、probe 只能观察。
 * @part-of testing/scenario-dsl — 场景 DSL 层
 */

import type { Command } from '@core/command-bus';
import type { CellCoord, ZoneType } from '@core/types';
import type { Item } from '@features/item/item.types';
import type { Pawn } from '@features/pawn/pawn.types';
import type { Zone } from '@world/zone-manager';

// ── 步骤类型 ──

/** 步骤种类：setup / command / waitFor / assert */
export type ScenarioStepKind = 'setup' | 'command' | 'waitFor' | 'assert';

/** 步骤执行状态 */
export type ScenarioStepStatus = 'pending' | 'running' | 'passed' | 'failed';

// ── 上下文分层 ──

/** Setup 上下文 — 可直接操作 harness 以搭建初始世界 */
export interface SetupContext {
  /** 场景 harness — 提供 world、map、tick 推进等能力 */
  harness: import('../scenario-harness/scenario-harness').ScenarioHarness;
}

/** 只读查询 API — 供 command 和 probe 使用 */
export interface ScenarioQueryApi {
  findPawnByName(name: string): Pawn | null;
  findItemAt(defId: string, cell: CellCoord): Item | null;
  findItemsByDef(defId: string): Item[];
  getZoneAt(cell: CellCoord): Zone | null;
  getZonesByType(zoneType: ZoneType): Zone[];
  isReserved(targetId: string): boolean;
  resolveAlias(alias: string): string | null;
  totalItemCountInCells(defId: string, cells: CellCoord[]): number;
  totalMaterialCountInWorld(defId: string): number;
  findBuildingAt(defId: string, cell: CellCoord): unknown | null;
  findBlueprintsByTargetDef(defId: string): unknown[];
  findPlantAt(cell: CellCoord): unknown | null;
}

/** Command 上下文 — 只能发正式命令和推进 tick */
export interface CommandContext {
  issueCommand(command: Command): void;
  stepTicks(count?: number): void;
  query: ScenarioQueryApi;
}

/** Probe 上下文 — 只能读取状态 */
export interface ProbeContext {
  query: ScenarioQueryApi;
}

// ── 步骤定义 ──

/** 步骤基础接口 */
export interface ScenarioStepBase {
  /** 步骤种类 */
  kind: ScenarioStepKind;
  /** 步骤标题 — 业务可读，适合直接展示在 HUD 中 */
  title: string;
  /** 步骤详细说明 */
  detail?: string;
}

/** Setup 步骤 — 用 fixture 搭建初始世界 */
export interface SetupStep extends ScenarioStepBase {
  kind: 'setup';
  /** 执行函数 — 拿到 SetupContext */
  run: (context: SetupContext) => Promise<void> | void;
}

/** Command 步骤 — 发正式命令推进业务 */
export interface CommandStep extends ScenarioStepBase {
  kind: 'command';
  /** 执行函数 — 拿到 CommandContext */
  run: (context: CommandContext) => Promise<void> | void;
}

/** 等待步骤 — 等待世界进入某种状态 */
export interface WaitForStep extends ScenarioStepBase {
  kind: 'waitFor';
  /** 条件判断函数 — 拿到 ProbeContext */
  condition: (context: ProbeContext) => boolean;
  /** 最大等待 tick 数 */
  timeoutTicks: number;
  /** 超时时的错误说明 */
  timeoutMessage?: string;
}

/** 断言步骤 — 验证当前状态 */
export interface AssertStep extends ScenarioStepBase {
  kind: 'assert';
  /** 断言函数 — 拿到 ProbeContext */
  assert: (context: ProbeContext) => boolean;
  /** 失败时的上下文描述 */
  failureMessage?: string;
}

/** 任意步骤联合类型 */
export type ScenarioStep = SetupStep | CommandStep | WaitForStep | AssertStep;

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
  setup: SetupStep[];
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
