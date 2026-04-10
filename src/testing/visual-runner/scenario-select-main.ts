/**
 * @file scenario-select-main.ts
 * @description 场景选择入口 — 展示所有已注册场景的选择界面，
 *              点击场景后切换到可视运行模式
 * @dependencies scenario-registry — 场景注册表；
 *               visual-scenario-controller — 协调器；scenario-hud — HUD 组件
 * @part-of testing/visual-runner — 可视运行层
 */

import { render, h } from 'preact';
import { scenarioRegistry } from '../scenario-registry';
import { createVisualScenarioController, ControllerState } from './visual-scenario-controller';
import { ScenarioHud } from './scenario-hud';
import type { ScenarioDefinition } from '../scenario-dsl/scenario.types';

// ── URL 参数检测：如果已指定场景则直接运行 ──

const params = new URLSearchParams(window.location.search);
const scenarioId = params.get('scenario');

if (scenarioId) {
  // 直接运行指定场景
  const scenario = scenarioRegistry.find(s => s.id === scenarioId);
  if (scenario) {
    startScenario(scenario);
  } else {
    showSelectPage(`场景 "${scenarioId}" 不存在`);
  }
} else {
  // 展示选择界面
  showSelectPage(null);
}

// ── 选择页面 ──

/** 展示场景选择界面 */
function showSelectPage(errorMsg: string | null) {
  const selectRoot = document.getElementById('select-root')!;
  const runnerRoot = document.getElementById('runner-root')!;

  selectRoot.classList.add('active');
  runnerRoot.classList.remove('active');

  selectRoot.innerHTML = '';

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

  // 点击启动
  card.addEventListener('click', () => {
    // 更新 URL（不刷新页面）
    const url = new URL(window.location.href);
    url.searchParams.set('scenario', scenario.id);
    window.history.pushState({}, '', url.toString());

    startScenario(scenario);
  });

  return card;
}

// ── 场景运行 ──

/** 启动场景可视运行 */
function startScenario(scenario: ScenarioDefinition) {
  const selectRoot = document.getElementById('select-root')!;
  const runnerRoot = document.getElementById('runner-root')!;

  // 切换视图
  selectRoot.classList.remove('active');
  runnerRoot.classList.add('active');

  // 挂载 HUD
  const hudContainer = document.getElementById('scenario-ui-root')!;

  function renderHud(state: ControllerState) {
    render(
      h(ScenarioHud, {
        title: state.title,
        currentTick: state.currentTick,
        currentStepTitle: state.currentStepTitle,
        visualSteps: state.visualSteps,
        shadowSteps: state.shadowSteps,
        divergence: state.divergence,
      }),
      hudContainer,
    );
  }

  // 创建控制器并运行
  const controller = createVisualScenarioController(scenario, renderHud);

  controller.run().then(result => {
    console.log(`[Scenario] ${scenario.title}: ${result.status}`);
    for (const step of result.steps) {
      console.log(`  [${step.status}] ${step.title}${step.ticksElapsed != null ? ` (${step.ticksElapsed} ticks)` : ''}`);
      if (step.error) console.log(`    ERROR: ${step.error}`);
    }
  });
}
