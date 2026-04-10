/**
 * @file scenario-harness.ts
 * @description Scenario Harness — 统一搭建测试世界、推进 tick、执行场景脚本的核心运行时。
 *              无头与可视模式共享此 harness 实现同源执行。
 * @dependencies bootstrap/* — 共享启动基础设施；world/* — 世界和地图；
 *               scenario-dsl — 步骤和场景类型
 * @part-of testing/scenario-harness — 场景 harness 层
 */

import { buildDefDatabase } from '@defs/index';
import { createWorld, World } from '@world/world';
import { createGameMap, GameMap } from '@world/game-map';
import { buildDefaultSystems, registerDefaultCommands } from '@bootstrap/default-registrations';
import { advanceWorldTick } from '@bootstrap/world-step';
import { resetIdCounter } from '@core/types';
import type {
  ScenarioDefinition,
  ScenarioResult,
  StepResult,
  ScenarioStep,
  ScenarioStepContext,
} from '../scenario-dsl/scenario.types';
import { createCheckpointSnapshot, CheckpointSnapshot } from './checkpoint-snapshot';

/** Scenario Harness 对外接口 */
export interface ScenarioHarness {
  /** 游戏世界 */
  world: World;
  /** 测试地图 */
  map: GameMap;

  /**
   * 推进指定数量的 tick
   * @param count - 要推进的 tick 数
   */
  stepTicks(count: number): void;

  /**
   * 生成当前状态的 checkpoint 快照
   */
  createCheckpoint(): CheckpointSnapshot;

  /**
   * 执行单个步骤（供 visual controller 逐步调用）
   * @param step - 场景步骤
   * @returns 步骤运行结果
   */
  executeStep(step: ScenarioStep): Promise<StepResult>;

  /**
   * 执行完整场景脚本
   * @param scenario - 场景定义
   * @returns 场景运行结果
   */
  runScenario(scenario: ScenarioDefinition): Promise<ScenarioResult>;
}

/**
 * 创建 Scenario Harness — 初始化完整的测试世界
 *
 * @param options - 可选配置
 * @returns harness 实例
 */
export function createScenarioHarness(options?: {
  seed?: number;
  mapWidth?: number;
  mapHeight?: number;
}): ScenarioHarness {
  const seed = options?.seed ?? 12345;
  const mapWidth = options?.mapWidth ?? 40;
  const mapHeight = options?.mapHeight ?? 40;

  // 重置 ID 计数器，确保每次测试的对象 ID 可预测
  resetIdCounter(0);

  // 构建世界
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed });
  const map = createGameMap({ id: 'scenario', width: mapWidth, height: mapHeight });
  world.maps.set(map.id, map);

  // 添加玩家派系
  world.factions.set('player', { id: 'player', name: 'Colony', isPlayer: true, hostile: false });

  // 初始化地形为全草地（测试场景需要可通行的平地）
  map.terrain.forEach((x, y) => {
    map.terrain.set(x, y, 'grass');
  });
  // 重建寻路网格
  map.pathGrid.rebuildFrom(map, defs);

  // 注册命令和系统
  registerDefaultCommands(world);
  world.tickRunner.registerAll(buildDefaultSystems());

  /** 推进指定数量的 tick */
  function stepTicks(count: number): void {
    for (let i = 0; i < count; i++) {
      advanceWorldTick(world);
    }
  }

  /** 生成 checkpoint 快照 */
  function createCheckpoint(): CheckpointSnapshot {
    return createCheckpointSnapshot(world, map);
  }

  /** 执行单个步骤 */
  async function executeStep(step: ScenarioStep, ctx: ScenarioStepContext): Promise<StepResult> {
    const result: StepResult = {
      title: step.title,
      kind: step.kind,
      status: 'running',
    };

    try {
      switch (step.kind) {
        case 'action': {
          await step.run(ctx);
          result.status = 'passed';
          break;
        }
        case 'waitFor': {
          let elapsed = 0;
          while (!step.condition(ctx)) {
            if (elapsed >= step.timeoutTicks) {
              result.status = 'failed';
              result.error = step.timeoutMessage ?? `等待超时：在 ${step.timeoutTicks} tick 内未满足条件 — ${step.title}`;
              result.ticksElapsed = elapsed;
              return result;
            }
            stepTicks(1);
            elapsed++;
          }
          result.status = 'passed';
          result.ticksElapsed = elapsed;
          break;
        }
        case 'assert': {
          const ok = step.assert(ctx);
          if (ok) {
            result.status = 'passed';
          } else {
            result.status = 'failed';
            result.error = step.failureMessage ?? `断言失败：${step.title}`;
          }
          break;
        }
      }
    } catch (err: any) {
      result.status = 'failed';
      result.error = err?.message ?? String(err);
    }

    return result;
  }

  /** 执行完整场景 */
  async function runScenario(scenario: ScenarioDefinition): Promise<ScenarioResult> {
    const ctx: ScenarioStepContext = { harness };
    const steps: StepResult[] = [];
    let failed = false;

    // 执行 setup 步骤
    for (const step of scenario.setup) {
      const r = await executeStep(step, ctx);
      steps.push(r);
      if (r.status === 'failed') {
        failed = true;
        break;
      }
    }

    // 执行 script 步骤
    if (!failed) {
      for (const step of scenario.script) {
        const r = await executeStep(step, ctx);
        steps.push(r);
        if (r.status === 'failed') {
          failed = true;
          break;
        }
      }
    }

    // 执行 expect 步骤
    if (!failed) {
      for (const step of scenario.expect) {
        const r = await executeStep(step, ctx);
        steps.push(r);
        if (r.status === 'failed') {
          failed = true;
          break;
        }
      }
    }

    return {
      scenarioId: scenario.id,
      status: failed ? 'failed' : 'passed',
      steps,
      totalTicks: world.tick,
    };
  }

  /** 执行单个步骤（供外部逐步调用） */
  async function executeStepPublic(step: ScenarioStep): Promise<StepResult> {
    const ctx: ScenarioStepContext = { harness };
    return executeStep(step, ctx);
  }

  const harness: ScenarioHarness = {
    world,
    map,
    stepTicks,
    createCheckpoint,
    executeStep: executeStepPublic,
    runScenario,
  };

  return harness;
}
