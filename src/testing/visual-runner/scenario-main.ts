/**
 * @file scenario-main.ts
 * @description 可视模式入口 — 启动真实 Phaser 场景并挂载 Scenario HUD，
 *              自动执行指定场景脚本并同步运行 shadow headless runner。
 *              此入口用于单场景直接运行（scenario.html），
 *              工作台模式请使用 scenario-select-main.ts。
 * @dependencies visual-scenario-controller — 协调器；scenario-hud — HUD 组件；
 *               scenario-registry — 场景注册表
 * @part-of testing/visual-runner — 可视运行层
 */

import { render, h } from 'preact';
import { scenarioRegistry } from '../scenario-registry';
import { createVisualScenarioController, ControllerState } from './visual-scenario-controller';
import { ScenarioHud } from './scenario-hud';

// 从 URL 参数获取要运行的场景 ID
const params = new URLSearchParams(window.location.search);
const scenarioId = params.get('scenario') ?? 'woodcutting';

// 查找场景
const scenario = scenarioRegistry.find(s => s.id === scenarioId);
if (!scenario) {
  document.body.innerHTML = `<p style="color:red;font-size:20px;padding:20px;">
    场景 "${scenarioId}" 不存在。可用场景：${scenarioRegistry.map(s => s.id).join(', ')}
  </p>`;
  throw new Error(`Scenario "${scenarioId}" not found`);
}

// 挂载 HUD
const hudRoot = document.getElementById('scenario-ui-root');
if (!hudRoot) throw new Error('找不到 #scenario-ui-root 容器');
const hudContainer: HTMLElement = hudRoot;

function renderHud(state: ControllerState) {
  render(
    h(ScenarioHud, {
      scenarioId: state.scenarioId,
      title: state.title,
      sessionStatus: state.sessionStatus,
      currentTick: state.currentTick,
      currentSpeed: state.currentSpeed,
      currentSpeedLabel: state.currentSpeedLabel,
      currentStepTitle: state.currentStepTitle,
      visualSteps: state.visualSteps,
      shadowSteps: state.shadowSteps,
      divergence: state.divergence,
    }),
    hudContainer,
  );
}

// 创建控制器并启动
const controller = createVisualScenarioController(scenario, renderHud);

// 单场景直接运行模式 — 自动开始执行
controller.start().then(() => {
  const result = controller.getState().result;
  if (result) {
    console.log(`[Scenario] ${scenario.title}: ${result.status}`);
    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }
  }
});
