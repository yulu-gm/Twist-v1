/**
 * @file visual-scenario-controller.ts
 * @description Visual Scenario Controller — 工作台 session 生命周期拥有者。
 *              启动真实 Phaser 游戏渲染场景世界，使用 Phaser 游戏循环驱动 tick，
 *              同时运行 shadow headless runner 进行对比。
 *              Shadow 先独立完整跑完（保证 ID 一致），缓存每步结果；
 *              Visual 逐步执行时，从缓存里同步更新 shadow 列的 HUD 进度。
 *
 *              session 状态模型：
 *              idle → ready → running ⇄ paused → completed / failed
 *              任何状态都可以 restart（→ ready）或 destroy
 *
 * @dependencies scenario-harness — 测试世界搭建；scenario-dsl — 场景类型；
 *               shadow-runner — diff 逻辑；bootstrap — Phaser 启动（通过依赖注入）
 * @part-of testing/visual-runner — 可视运行层
 */

import { createScenarioHarness } from '../scenario-harness/scenario-harness';
import type { ScenarioDefinition, ScenarioStep, StepResult, ScenarioResult, SetupContext, CommandContext, ProbeContext } from '../scenario-dsl/scenario.types';
import { createScenarioQueryApi } from '../scenario-probes/query-api';
import { diffCheckpointSnapshots, DivergenceRecord } from './shadow-runner';
import type { StepSummary } from './scenario-hud';
import { SimSpeed } from '../../core/types';
import { getClockDisplay } from '../../core/clock';
import type { World } from '../../world/world';

/** 会话状态 — 工作台 session 的生命周期阶段 */
export type ControllerSessionStatus = 'ready' | 'running' | 'paused' | 'completed' | 'failed';

/** Controller 状态 — 供 HUD 组件读取 */
export interface ControllerState {
  /** 场景 ID */
  scenarioId: string;
  /** 场景标题 */
  title: string;
  /** 会话状态 */
  sessionStatus: ControllerSessionStatus;
  /** 当前速度 */
  currentSpeed: SimSpeed;
  /** 当前速度的用户可读 label */
  currentSpeedLabel: string;
  /** 当前 tick */
  currentTick: number;
  /** 当前场景时间显示 */
  currentClockDisplay: string;
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
 * bootstrap 函数签名 — 与 bootstrapPhaser 一致，
 * 通过依赖注入传入以避免测试环境加载 Phaser
 */
type BootstrapGameFn = (world: World, uiBridge?: any, uiPorts?: any, parent?: string) => any;

/** Controller 依赖注入 — 允许测试替换 Phaser bootstrap 和 DOM 清理 */
export interface VisualScenarioControllerDeps {
  /** Phaser 游戏 bootstrap 函数 */
  bootstrapGame?: BootstrapGameFn;
  /** 清空 Phaser 容器的 DOM 操作 */
  clearGameContainer?: (parentId: string) => void;
}

/** 运行模式 — 连续运行 或 运行到下一个 gate */
type RunMode = 'continuous' | 'next-gate';

/**
 * 速度枚举值对应的用户可读 label
 */
function formatSpeedLabel(speed: SimSpeed): string {
  switch (speed) {
    case SimSpeed.Paused: return 'Paused';
    case SimSpeed.Normal: return '1x';
    case SimSpeed.Fast: return '2x';
    case SimSpeed.UltraFast: return '3x';
    default: return String(speed);
  }
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
 * 创建 Visual Scenario Controller — 工作台 session 生命周期拥有者
 *
 * 执行策略：
 * 1. 创建后处于 ready 状态，不自动执行
 * 2. start() 时先创建 shadow harness 并独立完整跑完场景（独占全局 ID 计数器，
 *    从 0 分配，与 headless 回归测试一致），缓存每步结果
 * 3. 再创建 visual harness（重新 reset ID，保证两边 ID 一致）
 * 4. Visual 逐步执行：setup → 启动 Phaser → script/expect
 * 5. Visual 每完成一步，从 shadow 缓存取对应结果同步更新 HUD
 * 6. 最终 diff 快照时可按 ID 精确匹配
 *
 * @param scenario - 要运行的场景定义
 * @param onStateChange - 状态变更回调
 * @param deps - 依赖注入（测试时替换 Phaser bootstrap）
 */
export function createVisualScenarioController(
  scenario: ScenarioDefinition,
  onStateChange: (state: ControllerState) => void,
  deps: VisualScenarioControllerDeps = {},
) {
  // 依赖注入：默认使用真实 bootstrapPhaser，测试时替换为 mock
  let resolvedBootstrapGame: BootstrapGameFn | null = deps.bootstrapGame ?? null;
  const clearGameContainer = deps.clearGameContainer ?? ((parentId: string) => {
    const el = document.getElementById(parentId);
    if (el) el.innerHTML = '';
  });

  // 收集所有步骤用于 HUD 展示
  const allSteps: ScenarioStep[] = [
    ...scenario.setup,
    ...scenario.script,
    ...scenario.expect,
  ];

  let visualSteps: StepSummary[] = allSteps.map(s => ({ title: s.title, status: 'pending' }));
  let shadowSteps: StepSummary[] = allSteps.map(s => ({ title: s.title, status: 'pending' }));

  let divergence: DivergenceRecord | null = null;

  // 延迟创建 — start() 中按顺序初始化
  let visualHarness: ReturnType<typeof createScenarioHarness> | null = null;
  let shadowHarness: ReturnType<typeof createScenarioHarness> | null = null;

  // Phaser.Game 实例 — controller 负责创建和销毁
  let game: any = null;

  // session 守卫 — destroy 后忽略所有晚到的异步完成事件
  let disposed = false;

  // shadow 步骤结果缓存 — start() 后由 shadow runner 填充
  let shadowStepResults: StepResult[] = [];

  // 运行时上下文 — start() 后创建
  let contexts: { setup: SetupContext; command: CommandContext; probe: ProbeContext } | null = null;
  let visualResults: StepResult[] = [];
  let nextStepIndex = 0;

  // pause/resume 的 resolve 回调 — 用于暂停时阻塞 runScenarioLoop
  let pauseResolve: (() => void) | null = null;

  const state: ControllerState = {
    scenarioId: scenario.id,
    title: scenario.title,
    sessionStatus: 'ready',
    currentSpeed: SimSpeed.Paused,
    currentSpeedLabel: formatSpeedLabel(SimSpeed.Paused),
    currentTick: 0,
    currentClockDisplay: '',
    currentStepTitle: '',
    visualSteps,
    shadowSteps,
    divergence: null,
    done: false,
    result: null,
  };

  /** 通知 HUD 状态变更 */
  function emit() {
    if (disposed) return;
    state.currentTick = visualHarness?.world.tick ?? 0;
    state.currentClockDisplay = visualHarness ? getClockDisplay(visualHarness.world.clock) : '';
    state.divergence = divergence;
    onStateChange({ ...state });
  }

  /**
   * 在 visual 模式下执行单个步骤
   * setup/command 步骤立即执行；waitFor 步骤异步等待 Phaser 驱动的 tick；assert 步骤同步检查
   */
  async function executeVisualStep(
    step: ScenarioStep,
    ctxs: { setup: SetupContext; command: CommandContext; probe: ProbeContext },
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
          await step.run(ctxs.setup);
          result.status = 'passed';
          break;
        }
        case 'command': {
          await step.run(ctxs.command);
          result.status = 'passed';
          break;
        }
        case 'waitFor': {
          // 异步等待 — 由 Phaser 游戏循环推进 tick
          let elapsed = 0;
          while (!step.condition(ctxs.probe)) {
            if (disposed) return result;
            if (elapsed >= step.timeoutTicks) {
              result.status = 'failed';
              result.error = step.timeoutMessage ?? `等待超时：在 ${step.timeoutTicks} tick 内未满足条件 — ${step.title}`;
              result.ticksElapsed = elapsed;
              visualSteps[stepIndex].status = 'failed';
              emit();
              return result;
            }
            await waitForTick(visualHarness!.world);
            elapsed++;
            // 定期更新 HUD 显示当前 tick
            emit();
          }
          result.status = 'passed';
          result.ticksElapsed = elapsed;
          break;
        }
        case 'assert': {
          const ok = step.assert(ctxs.probe);
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
   * 同步 shadow 步骤状态到 HUD
   */
  function syncShadowStep(stepIndex: number) {
    if (stepIndex < shadowStepResults.length) {
      shadowSteps[stepIndex].status = shadowStepResults[stepIndex].status;
      emit();
    }
  }

  /**
   * 运行场景主循环 — 支持连续运行和运行到下一个 gate 两种模式
   *
   * @param mode - 'continuous' 持续运行直到完成或暂停；'next-gate' 运行到下一个 gate 后暂停
   */
  async function runScenarioLoop(mode: RunMode): Promise<void> {
    while (!disposed && nextStepIndex < allSteps.length) {
      // 如果被暂停，等待 resume
      if (state.sessionStatus === 'paused') return;

      const step = allSteps[nextStepIndex];
      const vr = await executeVisualStep(step, contexts!, nextStepIndex);
      if (disposed) return;

      visualResults.push(vr);
      syncShadowStep(nextStepIndex);
      nextStepIndex++;

      if (vr.status === 'failed') {
        return finalizeFailed();
      }

      // next-gate 模式：在 waitFor 满足或 command 完成后暂停
      if (mode === 'next-gate' && (step.kind === 'waitFor' || step.kind === 'command')) {
        return parkPaused();
      }
    }

    if (!disposed) {
      finalizeCompleted();
    }
  }

  /** 暂停并停在当前位置 */
  function parkPaused(): void {
    if (disposed) return;
    if (visualHarness) visualHarness.world.speed = SimSpeed.Paused;
    state.currentSpeed = SimSpeed.Paused;
    state.currentSpeedLabel = formatSpeedLabel(SimSpeed.Paused);
    state.sessionStatus = 'paused';
    emit();
  }

  /** 场景成功完成 */
  function finalizeCompleted(): void {
    if (disposed) return;

    // 暂停 Phaser tick 推进，防止拍快照时 tick 还在跑
    if (visualHarness) visualHarness.world.speed = SimSpeed.Paused;

    // 对比最终快照
    if (visualHarness && shadowHarness) {
      const visualSnap = visualHarness.createCheckpoint();
      const shadowSnap = shadowHarness.createCheckpoint();
      // 跳过 tick 比较 — visual 由 Phaser 帧驱动，shadow 由精确步进驱动，
      // tick 计数天然不同，不属于 simulation 分歧
      divergence = diffCheckpointSnapshots(visualSnap, shadowSnap, { skipTick: true });
    }

    const visualResult: ScenarioResult = {
      scenarioId: scenario.id,
      status: 'passed',
      steps: visualResults,
      totalTicks: visualHarness?.world.tick ?? 0,
    };

    state.done = true;
    state.result = visualResult;
    state.sessionStatus = 'completed';
    state.currentStepTitle = '全部通过';
    state.currentSpeed = SimSpeed.Paused;
    state.currentSpeedLabel = formatSpeedLabel(SimSpeed.Paused);
    emit();
  }

  /** 场景执行失败 */
  function finalizeFailed(): void {
    if (disposed) return;

    if (visualHarness) visualHarness.world.speed = SimSpeed.Paused;

    const visualResult: ScenarioResult = {
      scenarioId: scenario.id,
      status: 'failed',
      steps: visualResults,
      totalTicks: visualHarness?.world.tick ?? 0,
    };

    state.done = true;
    state.result = visualResult;
    state.sessionStatus = 'failed';
    state.currentStepTitle = '存在失败';
    state.currentSpeed = SimSpeed.Paused;
    state.currentSpeedLabel = formatSpeedLabel(SimSpeed.Paused);
    emit();
  }

  // ── 公开 API ──

  /**
   * 开始执行场景 — 从 ready 状态转到 running
   * 如果是本 session 的第一次运行，先 bootstrap Phaser
   */
  async function start(): Promise<void> {
    if (disposed || state.sessionStatus !== 'ready') return;

    state.sessionStatus = 'running';
    emit();

    // ── 阶段 1：shadow 先独立完整跑完 ──
    // shadow 独占全局 ID 计数器，从 0 分配，与 headless 回归测试一致
    shadowHarness = createScenarioHarness({ seed: 12345 });
    const shadowResult = await shadowHarness.runScenario(scenario);
    if (disposed) return;

    // 缓存 shadow 每步结果，供后续 HUD 同步展示
    shadowStepResults = shadowResult.steps;

    // ── 阶段 2：创建 visual harness ──
    // 重新 reset ID 计数器，visual 也从 0 分配，保证两边对象 ID 一致
    visualHarness = createScenarioHarness({ seed: 12345 });

    // 构建分层上下文
    const aliases = new Map<string, string>();
    const query = createScenarioQueryApi(visualHarness, aliases);
    const setupCtx: SetupContext = { harness: visualHarness };
    const commandCtx: CommandContext = {
      issueCommand: (cmd) => visualHarness!.world.commandQueue.push(cmd),
      stepTicks: (count = 1) => visualHarness!.stepTicks(count),
      query,
    };
    const probeCtx: ProbeContext = { query };
    contexts = { setup: setupCtx, command: commandCtx, probe: probeCtx };

    visualResults = [];
    nextStepIndex = 0;

    // 暂停速度，setup 阶段不需要 Phaser 推进 tick
    visualHarness.world.speed = SimSpeed.Paused;

    // ── 阶段 3：执行 setup 步骤 ──
    while (!disposed && nextStepIndex < scenario.setup.length) {
      const step = allSteps[nextStepIndex];
      const vr = await executeVisualStep(step, contexts, nextStepIndex);
      if (disposed) return;
      visualResults.push(vr);
      syncShadowStep(nextStepIndex);
      nextStepIndex++;
      if (vr.status === 'failed') {
        return finalizeFailed();
      }
    }

    // ── 阶段 4：bootstrap Phaser 游戏渲染 ──
    if (!game) {
      // 延迟解析 bootstrapGame — 非注入时从 adapter/bootstrap 动态导入
      if (!resolvedBootstrapGame) {
        const mod = await import('../../adapter/bootstrap');
        resolvedBootstrapGame = mod.bootstrapPhaser;
      }
      game = resolvedBootstrapGame!(
        visualHarness.world,
        undefined,
        undefined,
        'scenario-game-container',
      );
    }
    if (disposed) return;

    // 设置正常速度，让 Phaser 游戏循环开始推进 tick
    state.currentSpeed = SimSpeed.Normal;
    state.currentSpeedLabel = formatSpeedLabel(SimSpeed.Normal);
    visualHarness.world.speed = SimSpeed.Normal;
    emit();

    // ── 阶段 5+6：执行 script 和 expect 步骤 ──
    await runScenarioLoop('continuous');
  }

  /** 暂停 — 从 running 转到 paused */
  function pause(): void {
    if (state.sessionStatus !== 'running') return;
    parkPaused();
  }

  /** 恢复 — 从 paused 转到 running */
  function resume(): void {
    if (state.sessionStatus !== 'paused') return;
    // 如果当前速度是 Paused，恢复到 Normal
    state.currentSpeed = state.currentSpeed === SimSpeed.Paused ? SimSpeed.Normal : state.currentSpeed;
    state.currentSpeedLabel = formatSpeedLabel(state.currentSpeed);
    state.sessionStatus = 'running';
    if (visualHarness) visualHarness.world.speed = state.currentSpeed;
    emit();
    // 继续执行未完成的步骤
    void runScenarioLoop('continuous');
  }

  /**
   * 设置速度 — 在 running 或 paused 状态下切换 simulation 速度
   * 设为 Paused 等价于 pause()，设为其他值在 paused 下等价于 resume
   */
  function setSpeed(speed: SimSpeed): void {
    if (state.sessionStatus === 'ready' || state.sessionStatus === 'completed' || state.sessionStatus === 'failed') return;
    state.currentSpeed = speed;
    state.currentSpeedLabel = formatSpeedLabel(speed);
    if (visualHarness) visualHarness.world.speed = speed;
    if (speed === SimSpeed.Paused) {
      state.sessionStatus = 'paused';
    } else if (state.sessionStatus === 'paused') {
      state.sessionStatus = 'running';
      // 从 paused 切到非零速度时恢复执行
      void runScenarioLoop('continuous');
    }
    emit();
  }

  /**
   * 手动步进 — 只在 paused 状态下有效，推进指定数量的 tick
   */
  async function stepTicks(count: number): Promise<void> {
    if (state.sessionStatus !== 'paused' || count <= 0 || !visualHarness) return;
    visualHarness.stepTicks(count);
    state.currentTick = visualHarness.world.tick;
    state.currentClockDisplay = getClockDisplay(visualHarness.world.clock);
    emit();
  }

  /**
   * 运行到下一个 gate — 只在 paused 状态下有效
   * gate 定义为 waitFor 条件满足、command 完成、场景完成或失败
   */
  async function runUntilNextGate(): Promise<void> {
    if (state.sessionStatus !== 'paused') return;
    state.sessionStatus = 'running';
    if (visualHarness) {
      visualHarness.world.speed = state.currentSpeed === SimSpeed.Paused ? SimSpeed.Normal : state.currentSpeed;
    }
    emit();
    await runScenarioLoop('next-gate');
  }

  /**
   * 销毁当前 session — 释放 Phaser.Game 和所有异步资源
   */
  async function destroy(): Promise<void> {
    disposed = true;
    if (game) {
      game.destroy(true);
      game = null;
    }
    clearGameContainer('scenario-game-container');
    visualHarness = null;
    shadowHarness = null;
    contexts = null;
  }

  /**
   * 重跑场景 — 销毁旧 session，用同一场景重新创建全新的 session
   * 总是回到 ready 状态
   */
  async function restart(): Promise<void> {
    await destroy();

    // 重建全新 session
    disposed = false;
    visualSteps = allSteps.map(s => ({ title: s.title, status: 'pending' }));
    shadowSteps = allSteps.map(s => ({ title: s.title, status: 'pending' }));
    divergence = null;
    shadowStepResults = [];
    visualResults = [];
    nextStepIndex = 0;

    state.scenarioId = scenario.id;
    state.title = scenario.title;
    state.sessionStatus = 'ready';
    state.currentSpeed = SimSpeed.Paused;
    state.currentSpeedLabel = formatSpeedLabel(SimSpeed.Paused);
    state.currentTick = 0;
    state.currentClockDisplay = '';
    state.currentStepTitle = '';
    state.visualSteps = visualSteps;
    state.shadowSteps = shadowSteps;
    state.divergence = null;
    state.done = false;
    state.result = null;

    emit();
  }

  /** 订阅状态变更 — 返回取消订阅函数 */
  function subscribe(listener: (state: ControllerState) => void): () => void {
    // 当前实现通过 onStateChange 回调驱动，subscribe 作为额外的监听接口
    const originalOnStateChange = onStateChange;
    onStateChange = (s) => {
      originalOnStateChange(s);
      listener(s);
    };
    return () => {
      onStateChange = originalOnStateChange;
    };
  }

  // 初始 emit — 通知 HUD 初始 ready 状态
  emit();

  return {
    /** 获取 visual harness（供外部查询世界状态） */
    getVisualHarness: () => visualHarness,
    /** 获取当前状态 */
    getState: () => state,
    /** 订阅状态变更 */
    subscribe,
    /** 开始执行场景 */
    start,
    /** 暂停 */
    pause,
    /** 恢复 */
    resume,
    /** 设置速度 */
    setSpeed,
    /** 手动步进 */
    stepTicks,
    /** 运行到下一个 gate */
    runUntilNextGate,
    /** 重跑场景 */
    restart,
    /** 销毁 session */
    destroy,
  };
}
