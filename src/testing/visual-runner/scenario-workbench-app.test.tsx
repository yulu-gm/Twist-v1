/**
 * @file scenario-workbench-app.test.tsx
 * @description 工作台页面壳层测试 — 验证 URL 加载进 ready 状态、
 *              返回选择页时清理 URL、以及 selector/workbench 模式切换
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole } from '@testing-library/dom';
import { bootstrapScenarioWorkbench } from './scenario-workbench-app';
import type { ControllerState } from './visual-scenario-controller';
import { SimSpeed } from '../../core/types';

/** 构造 mock controller 状态 */
function mockControllerState(overrides: Partial<ControllerState> = {}): ControllerState {
  return {
    scenarioId: 'woodcutting',
    title: '砍树',
    sessionStatus: 'ready',
    currentTick: 0,
    currentSpeed: SimSpeed.Paused,
    currentSpeedLabel: 'Paused',
    currentStepTitle: '',
    visualSteps: [],
    shadowSteps: [],
    divergence: null,
    done: false,
    result: null,
    ...overrides,
  };
}

/** 构造 mock controller */
function createMockController(state: ControllerState) {
  return {
    getState: () => state,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    setSpeed: vi.fn(),
    stepTicks: vi.fn(),
    runUntilNextGate: vi.fn(),
    restart: vi.fn(),
    destroy: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    getVisualHarness: () => null,
  };
}

/** 设置标准的测试 DOM 结构 */
function setupTestDom() {
  document.body.innerHTML = `
    <div id="select-root"></div>
    <div id="runner-root">
      <div id="scenario-game-container"></div>
      <div id="scenario-ui-root"></div>
    </div>
  `;
}

describe('bootstrapScenarioWorkbench', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('从 URL 加载场景时进入 ready 状态，不自动开始执行', () => {
    const state = mockControllerState();
    const controller = createMockController(state);
    const historyPushState = vi.fn();
    setupTestDom();

    bootstrapScenarioWorkbench({
      initialUrl: 'http://localhost/scenario-select.html?scenario=woodcutting',
      createController: () => controller as any,
      historyPushState,
    });

    // 不应自动调用 start
    expect(controller.start).not.toHaveBeenCalled();
    // runner-root 应变为 active
    expect(document.getElementById('runner-root')?.classList.contains('active')).toBe(true);
    // select-root 不应 active
    expect(document.getElementById('select-root')?.classList.contains('active')).toBe(false);
  });

  it('点击 Back to Scenarios 时销毁 controller、清理 URL 并回到选择页', () => {
    const state = mockControllerState();
    const controller = createMockController(state);
    const historyPushState = vi.fn();
    setupTestDom();

    bootstrapScenarioWorkbench({
      initialUrl: 'http://localhost/scenario-select.html?scenario=woodcutting',
      createController: () => controller as any,
      historyPushState,
    });

    // 找到 Back to Scenarios 按钮并点击
    fireEvent.click(getByRole(document.body, 'button', { name: 'Back to Scenarios' }));

    expect(controller.destroy).toHaveBeenCalledTimes(1);
    // URL 应移除 scenario 参数
    expect(historyPushState).toHaveBeenCalled();
    const pushedUrl = historyPushState.mock.calls[historyPushState.mock.calls.length - 1][2];
    expect(pushedUrl).not.toContain('scenario=');
    // select-root 应变为 active
    expect(document.getElementById('select-root')?.classList.contains('active')).toBe(true);
  });

  it('没有 URL 场景参数时显示选择页', () => {
    const historyPushState = vi.fn();
    setupTestDom();

    bootstrapScenarioWorkbench({
      initialUrl: 'http://localhost/scenario-select.html',
      createController: () => { throw new Error('不应创建 controller'); },
      historyPushState,
    });

    // select-root 应变为 active
    expect(document.getElementById('select-root')?.classList.contains('active')).toBe(true);
    expect(document.getElementById('runner-root')?.classList.contains('active')).toBe(false);
  });
});
