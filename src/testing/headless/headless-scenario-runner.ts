/**
 * @file headless-scenario-runner.ts
 * @description 无头场景运行器 — 不启动 Phaser，直接驱动 World/CommandBus/TickRunner
 *              执行场景脚本，适合本地快速回归和 CI 使用
 * @dependencies scenario-harness — 测试世界搭建与执行；scenario-dsl — 场景类型
 * @part-of testing/headless — 无头运行层
 */

import { createScenarioHarness } from '@testing/scenario-harness/scenario-harness';
import type { CheckpointSnapshot } from '@testing/scenario-harness/checkpoint-snapshot';
import type { ScenarioDefinition, ScenarioResult } from '@testing/scenario-dsl/scenario.types';

/** 无头场景运行结果 — 在 ScenarioResult 基础上附带最终快照 */
export interface HeadlessScenarioResult extends ScenarioResult {
  /** 场景执行结束后的 checkpoint 快照 */
  finalSnapshot: CheckpointSnapshot;
}

/**
 * 运行无头场景测试
 *
 * @param scenario - 场景定义
 * @param options - 可选配置（seed、地图大小）
 * @returns 包含场景结果和最终快照的运行结果
 */
export async function runHeadlessScenario(
  scenario: ScenarioDefinition,
  options?: { seed?: number; mapWidth?: number; mapHeight?: number },
): Promise<HeadlessScenarioResult> {
  const harness = createScenarioHarness(options);
  const result = await harness.runScenario(scenario);

  return {
    ...result,
    finalSnapshot: harness.createCheckpoint(),
  };
}
