/**
 * @file scenario-workbench-app.ts
 * @description 工作台页面壳层 — 可测试的页面级协调器。
 *              维护 selector/workbench 两种模式，协调 URL 参数、
 *              controller 创建和销毁、HUD 渲染。
 *              不直接操作 world，全部通过 controller API 驱动。
 * @dependencies scenario-registry — 场景注册表；scenario-hud — HUD 组件；
 *               visual-scenario-controller — session 生命周期拥有者
 * @part-of testing/visual-runner — 可视运行层
 */

import { render, h } from 'preact';
import { scenarioRegistry } from '../scenario-registry';
import { ScenarioHud } from './scenario-hud';
import { createVisualScenarioController, ControllerState, VisualScenarioControllerDeps } from './visual-scenario-controller';
import type { ScenarioDefinition } from '../scenario-dsl/scenario.types';

/** 工作台 bootstrap 配置 — 支持依赖注入以便测试 */
export interface WorkbenchBootstrapOptions {
  /** 初始 URL（测试时替代 window.location.href） */
  initialUrl?: string;
  /** controller 工厂（测试时注入 mock） */
  createController?: typeof createVisualScenarioController;
  /** history.pushState 替代（测试时注入 mock） */
  historyPushState?: (data: any, unused: string, url: string) => void;
  /** controller 依赖注入 */
  controllerDeps?: VisualScenarioControllerDeps;
}

/**
 * 启动场景工作台 — 页面级入口
 *
 * 职责：
 * 1. 读取 URL 中的 scenario 参数
 * 2. 维护 selector 和 workbench 两种页面模式
 * 3. 创建和释放 controller session
 * 4. 把 controller 状态接到 HUD
 * 5. 响应 HUD 发出的用户操作
 *
 * @param options - bootstrap 配置
 */
export function bootstrapScenarioWorkbench(options: WorkbenchBootstrapOptions = {}) {
  const {
    initialUrl = window.location.href,
    createController: controllerFactory = createVisualScenarioController,
    historyPushState = (data, unused, url) => window.history.pushState(data, unused, url),
    controllerDeps = {},
  } = options;

  let activeController: ReturnType<typeof createVisualScenarioController> | null = null;

  // ── 模式切换 ──

  /** 切换 selector / workbench 模式的可见性 */
  function toggleMode(mode: 'selector' | 'workbench') {
    document.getElementById('select-root')?.classList.toggle('active', mode === 'selector');
    document.getElementById('runner-root')?.classList.toggle('active', mode === 'workbench');
  }

  /** 更新 URL 的 scenario 参数 */
  function setScenarioQuery(id: string | null) {
    const url = new URL(initialUrl);
    if (id) url.searchParams.set('scenario', id);
    else url.searchParams.delete('scenario');
    historyPushState({}, '', url.toString());
  }

  // ── 选择页 ──

  /** 进入选择页模式 — 销毁当前 controller，清理 URL */
  function enterSelector(errorMsg: string | null = null) {
    if (activeController) {
      activeController.destroy();
      activeController = null;
    }
    setScenarioQuery(null);
    showSelectPage(errorMsg);
  }

  /** 展示场景选择界面 */
  function showSelectPage(errorMsg: string | null) {
    toggleMode('selector');

    const selectRoot = document.getElementById('select-root')!;
    selectRoot.innerHTML = '';

    // 清空 HUD
    const hudContainer = document.getElementById('scenario-ui-root');
    if (hudContainer) render(null as any, hudContainer);

    // 构建选择页面 DOM
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'max-width: 800px; margin: 0 auto; padding: 40px 20px;';

    // 标题
    const title = document.createElement('h1');
    title.textContent = 'Scenario Visual Testing';
    title.style.cssText = 'font-size: 28px; margin-bottom: 8px; color: #93c5fd;';
    wrapper.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = '选择一个场景开始可视化验收测试';
    subtitle.style.cssText = 'font-size: 14px; color: #888; margin-bottom: 32px;';
    wrapper.appendChild(subtitle);

    // 错误提示
    if (errorMsg) {
      const errDiv = document.createElement('div');
      errDiv.textContent = errorMsg;
      errDiv.style.cssText = 'background: #7f1d1d; color: #fca5a5; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px; font-size: 14px;';
      wrapper.appendChild(errDiv);
    }

    // 场景卡片列表
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 16px;';

    for (const scenario of scenarioRegistry) {
      const card = createScenarioCard(scenario);
      grid.appendChild(card);
    }

    wrapper.appendChild(grid);

    // 底部提示
    const footer = document.createElement('p');
    footer.style.cssText = 'margin-top: 40px; font-size: 12px; color: #555; text-align: center;';
    footer.textContent = `已注册 ${scenarioRegistry.length} 个场景 · 也可直接访问 ?scenario=<id> 跳过选择`;
    wrapper.appendChild(footer);

    selectRoot.appendChild(wrapper);
  }

  /** 创建单个场景卡片 */
  function createScenarioCard(scenario: ScenarioDefinition): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = `
      background: #16213e; border: 1px solid #334155; border-radius: 8px;
      padding: 20px; cursor: pointer; transition: all 0.15s ease;
    `;

    card.addEventListener('mouseenter', () => {
      card.style.borderColor = '#3b82f6';
      card.style.background = '#1e293b';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = '#334155';
      card.style.background = '#16213e';
    });

    // 场景 ID 标签
    const idTag = document.createElement('span');
    idTag.textContent = scenario.id;
    idTag.style.cssText = 'display: inline-block; background: #1e3a5f; color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-bottom: 8px;';
    card.appendChild(idTag);

    // 场景标题
    const titleEl = document.createElement('h2');
    titleEl.textContent = scenario.title;
    titleEl.style.cssText = 'font-size: 18px; margin-bottom: 8px; color: #e2e8f0;';
    card.appendChild(titleEl);

    // 场景描述
    if (scenario.description) {
      const descEl = document.createElement('p');
      descEl.textContent = scenario.description;
      descEl.style.cssText = 'font-size: 13px; color: #94a3b8; margin-bottom: 12px; line-height: 1.5;';
      card.appendChild(descEl);
    }

    // 步骤统计
    const stepCount = scenario.setup.length + scenario.script.length + scenario.expect.length;
    const statsEl = document.createElement('div');
    statsEl.style.cssText = 'font-size: 11px; color: #64748b;';
    statsEl.textContent = `${stepCount} 步 · setup ${scenario.setup.length} / script ${scenario.script.length} / expect ${scenario.expect.length}`;
    card.appendChild(statsEl);

    // 点击进入工作台
    card.addEventListener('click', () => {
      enterWorkbench(scenario);
    });

    return card;
  }

  // ── 工作台 ──

  /** 进入工作台模式 — 创建 controller 并渲染 HUD */
  function enterWorkbench(scenario: ScenarioDefinition) {
    // 先销毁旧 controller
    if (activeController) {
      activeController.destroy();
      activeController = null;
    }

    // 更新 URL
    setScenarioQuery(scenario.id);

    // 切换到 workbench 模式
    toggleMode('workbench');

    // 创建 controller（ready 状态，不自动开跑）
    activeController = controllerFactory(scenario, renderHud, controllerDeps);

    // 渲染初始 HUD
    renderHud(activeController.getState());
  }

  /** 渲染 HUD — 把 controller 状态接到 HUD 组件 */
  function renderHud(state: ControllerState) {
    const hudContainer = document.getElementById('scenario-ui-root');
    if (!hudContainer) return;

    render(
      h(ScenarioHud, {
        scenarioId: state.scenarioId,
        title: state.title,
        sessionStatus: state.sessionStatus,
        currentTick: state.currentTick,
        currentClockDisplay: state.currentClockDisplay,
        currentSpeed: state.currentSpeed,
        currentSpeedLabel: state.currentSpeedLabel,
        currentStepTitle: state.currentStepTitle,
        visualSteps: state.visualSteps,
        shadowSteps: state.shadowSteps,
        divergence: state.divergence,
        onStart: () => void activeController?.start(),
        onPause: () => activeController?.pause(),
        onResume: () => activeController?.resume(),
        onRestart: () => void activeController?.restart(),
        onBackToScenarios: () => enterSelector(),
        onSetSpeed: (speed) => activeController?.setSpeed(speed),
        onStepTicks: (count) => void activeController?.stepTicks(count),
        onRunToNextGate: () => void activeController?.runUntilNextGate(),
      }),
      hudContainer,
    );
  }

  // ── 初始化 ──

  const parsedUrl = new URL(initialUrl);
  const scenarioId = parsedUrl.searchParams.get('scenario');

  if (scenarioId) {
    // URL 中指定了场景 — 加载到 ready 状态
    const scenario = scenarioRegistry.find(s => s.id === scenarioId);
    if (scenario) {
      enterWorkbench(scenario);
    } else {
      enterSelector(`场景 "${scenarioId}" 不存在`);
    }
  } else {
    // 没有指定场景 — 显示选择页
    enterSelector();
  }
}
