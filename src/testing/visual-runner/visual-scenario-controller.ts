/**
 * @file visual-scenario-controller.ts
 * @description Visual Scenario Controller — 启动真实 Phaser 游戏渲染场景世界，
 *              使用 Phaser 游戏循环驱动 tick，同时运行 shadow headless runner 进行对比。
 *              Shadow 先独立完整跑完（保证 ID 一致），缓存每步结果；
 *              Visual 逐步执行时，从缓存里同步更新 shadow 列的 HUD 进度。
 * @dependencies scenario-harness — 测试世界搭建；scenario-dsl — 场景类型；
 *               shadow-runner — diff 逻辑；bootstrap — Phaser 启动
 * @part-of testing/visual-runner — 可视运行层
 */

import { createScenarioHarness } from '../scenario-harness/scenario-harness';
import type { ScenarioDefinition, ScenarioStep, StepResult, ScenarioResult, SetupContext, CommandContext, ProbeContext } from '../scenario-dsl/scenario.types';
import { createScenarioQueryApi } from '../scenario-probes/query-api';
import { diffCheckpointSnapshots, DivergenceRecord } from './shadow-runner';
import type { StepSummary } from './scenario-hud';
import { bootstrapPhaser } from '../../adapter/bootstrap';
import { SimSpeed } from '../../core/types';
import type { World } from '../../world/world';

/** Controller 状态 — 供 HUD 组件读取 */
export interface ControllerState {
  /** 场景标题 */
  title: string;
  /** 当前 tick */
  currentTick: number;
  /** 当前步骤标题 */
  currentStepTitle: string;
  /** Visual Runner 步骤摘要 */
  visualSteps: StepSummary[];
  /** Shadow Headless Runner 步骤摘要 */
  shadowSteps: StepSummary[];
  /** 分歧记录 */
  divergence: DivergenceRecord | null;
  /** 是否已完成 */
  done: boolean;
  /** 场景结果 */
  result: ScenarioResult | null;
}

/**
 * 等待 Phaser 游戏循环推进至少一个 tick
 *
 * @param world - 世界对象（从中读取 world.tick）
 * @returns 当 world.tick 增加时 resolve
 */
function waitForTick(world: World): Promise<void> {
  const startTick = world.tick;
  return new Promise(resolve => {
    function check() {
      if (world.tick > startTick) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    }
    requestAnimationFrame(check);
  });
}

/**
 * 创建 Visual Scenario Controller
 *
 * 执行策略：
 * 1. 先创建 shadow harness 并独立完整跑完场景（此时独占全局 ID 计数器，
 *    从 0 分配，与 headless 回归测试一致），缓存每步结果
 * 2. 再创建 visual harness（重新 reset ID，也从 0 分配，保证两边 ID 一致）
 * 3. Visual 逐步执行：setup → 启动 Phaser → script/expect
 * 4. Visual 每完成一步，从 shadow 缓存取对应结果同步更新 HUD
 * 5. 最终 diff 快照时可按 ID 精确匹配
 *
 * @param scenario - 要运行的场景定义
 * @param onStateChange - 状态变更回调
 */
export function createVisualScenarioController(
  scenario: ScenarioDefinition,
  onStateChange: (state: ControllerState) => void,
) {
  // 收集所有步骤用于 HUD 展示
  const allSteps: ScenarioStep[] = [
    ...scenario.setup,
    ...scenario.script,
    ...scenario.expect,
  ];

  const visualSteps: StepSummary[] = allSteps.map(s => ({ title: s.title, status: 'pending' }));
  const shadowSteps: StepSummary[] = allSteps.map(s => ({ title: s.title, status: 'pending' }));

  let divergence: DivergenceRecord | null = null;

  // 延迟创建 — run() 中按顺序初始化
  let visualHarness: ReturnType<typeof createScenarioHarness>;
  let shadowHarness: ReturnType<typeof createScenarioHarness>;

  const state: ControllerState = {
    title: scenario.title,
    currentTick: 0,
    currentStepTitle: '',
    visualSteps,
    shadowSteps,
    divergence: null,
    done: false,
    result: null,
  };

  /** 通知 HUD 状态变更 */
  function emit() {
    state.currentTick = visualHarness?.world.tick ?? 0;
    state.divergence = divergence;
    onStateChange({ ...state });
  }

  /**
   * 在 visual 模式下执行单个步骤
   * setup/command 步骤立即执行；waitFor 步骤异步等待 Phaser 驱动的 tick；assert 步骤同步检查
   */
  async function executeVisualStep(
    step: ScenarioStep,
    contexts: { setup: SetupContext; command: CommandContext; probe: ProbeContext },
    stepIndex: number,
  ): Promise<StepResult> {
    // 标记步骤为 running
    visualSteps[stepIndex].status = 'running';
    state.currentStepTitle = step.title;
    emit();

    const result: StepResult = {
      title: step.title,
      kind: step.kind,
      status: 'running',
    };

    try {
      switch (step.kind) {
        case 'setup': {
          await step.run(contexts.setup);
          result.status = 'passed';
          break;
        }
        case 'command': {
          await step.run(contexts.command);
          result.status = 'passed';
          break;
        }
        case 'waitFor': {
          // 异步等待 — 由 Phaser 游戏循环推进 tick
          let elapsed = 0;
          while (!step.condition(contexts.probe)) {
            if (elapsed >= step.timeoutTicks) {
              result.status = 'failed';
              result.error = step.timeoutMessage ?? `等待超时：在 ${step.timeoutTicks} tick 内未满足条件 — ${step.title}`;
              result.ticksElapsed = elapsed;
              visualSteps[stepIndex].status = 'failed';
              emit();
              return result;
            }
            await waitForTick(visualHarness.world);
            elapsed++;
            // 定期更新 HUD 显示当前 tick
            emit();
          }
          result.status = 'passed';
          result.ticksElapsed = elapsed;
          break;
        }
        case 'assert': {
          const ok = step.assert(contexts.probe);
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

    // 更新 HUD 步骤状态
    visualSteps[stepIndex].status = result.status;
    emit();

    return result;
  }

  /**
   * 运行场景 — shadow 先跑完，visual 再逐步执行，HUD 同步推进
   */
  async function run(): Promise<ScenarioResult> {
    // ── 阶段 1：shadow 先独立完整跑完 ──
    // shadow 独占全局 ID 计数器，从 0 分配，与 headless 回归测试一致
    shadowHarness = createScenarioHarness({ seed: 12345 });
    const shadowResult = await shadowHarness.runScenario(scenario);

    // 缓存 shadow 每步结果，供后续 HUD 同步展示
    const shadowStepResults = shadowResult.steps;

    // ── 阶段 2：创建 visual harness ──
    // 重新 reset ID 计数器，visual 也从 0 分配，保证两边对象 ID 一致
    visualHarness = createScenarioHarness({ seed: 12345 });

    // 构建分层上下文
    const aliases = new Map<string, string>();
    const query = createScenarioQueryApi(visualHarness, aliases);
    const setupCtx: SetupContext = { harness: visualHarness };
    const commandCtx: CommandContext = {
      issueCommand: (cmd) => visualHarness.world.commandQueue.push(cmd),
      stepTicks: (count = 1) => visualHarness.stepTicks(count),
      query,
    };
    const probeCtx: ProbeContext = { query };
    const contexts = { setup: setupCtx, command: commandCtx, probe: probeCtx };

    const visualResults: StepResult[] = [];
    let failed = false;
    let stepIndex = 0;

    // 暂停速度，setup 阶段不需要 Phaser 推进 tick
    visualHarness.world.speed = SimSpeed.Paused;

    // ── 阶段 3：执行 setup 步骤 ──
    for (const step of scenario.setup) {
      const vr = await executeVisualStep(step, contexts, stepIndex);
      visualResults.push(vr);

      // 从 shadow 缓存取对应结果同步更新 HUD
      if (stepIndex < shadowStepResults.length) {
        shadowSteps[stepIndex].status = shadowStepResults[stepIndex].status;
        emit();
      }

      stepIndex++;
      if (vr.status === 'failed') {
        failed = true;
        break;
      }
    }

    if (failed) {
      const result: ScenarioResult = {
        scenarioId: scenario.id,
        status: 'failed',
        steps: visualResults,
        totalTicks: visualHarness.world.tick,
      };
      state.done = true;
      state.result = result;
      state.currentStepTitle = '存在失败';
      emit();
      return result;
    }

    // ── 阶段 4：启动 Phaser 游戏渲染 ──
    bootstrapPhaser(
      visualHarness.world,
      undefined,
      undefined,
      'scenario-game-container',
    );

    // 设置正常速度，让 Phaser 游戏循环开始推进 tick
    visualHarness.world.speed = SimSpeed.Normal;

    // ── 阶段 5：逐步执行 script 步骤 ──
    for (const step of scenario.script) {
      const vr = await executeVisualStep(step, contexts, stepIndex);
      visualResults.push(vr);

      // 从 shadow 缓存取对应结果同步更新 HUD
      if (stepIndex < shadowStepResults.length) {
        shadowSteps[stepIndex].status = shadowStepResults[stepIndex].status;
        emit();
      }

      stepIndex++;
      if (vr.status === 'failed') {
        failed = true;
        break;
      }
    }

    // ── 阶段 6：逐步执行 expect 步骤 ──
    if (!failed) {
      for (const step of scenario.expect) {
        const vr = await executeVisualStep(step, contexts, stepIndex);
        visualResults.push(vr);

        if (stepIndex < shadowStepResults.length) {
          shadowSteps[stepIndex].status = shadowStepResults[stepIndex].status;
          emit();
        }

        stepIndex++;
        if (vr.status === 'failed') {
          failed = true;
          break;
        }
      }
    }

    // ── 阶段 7：暂停 visual world 并对比最终快照 ──
    // 暂停 Phaser tick 推进，防止拍快照时 tick 还在跑
    visualHarness.world.speed = SimSpeed.Paused;

    const visualSnap = visualHarness.createCheckpoint();
    const shadowSnap = shadowHarness.createCheckpoint();
    // 跳过 tick 比较 — visual 由 Phaser 帧驱动，shadow 由精确步进驱动，
    // tick 计数天然不同，不属于 simulation 分歧
    divergence = diffCheckpointSnapshots(visualSnap, shadowSnap, { skipTick: true });

    const visualResult: ScenarioResult = {
      scenarioId: scenario.id,
      status: failed ? 'failed' : 'passed',
      steps: visualResults,
      totalTicks: visualHarness.world.tick,
    };

    state.done = true;
    state.result = visualResult;
    state.currentStepTitle = visualResult.status === 'passed' ? '全部通过' : '存在失败';
    emit();

    return visualResult;
  }

  emit();

  return {
    /** 获取 visual harness（供外部查询世界状态） */
    getVisualHarness: () => visualHarness,
    /** 获取当前状态 */
    getState: () => state,
    /** 运行场景 */
    run,
  };
}
