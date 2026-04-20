/**
 * @file scenario-hud.test.tsx
 * @description Scenario HUD 组件测试 — 验证双列布局、分歧面板、工作台控件渲染
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { h } from 'preact';
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { SimSpeed } from '../../core/types';
import { ScenarioHud } from './scenario-hud';

describe('ScenarioHud', () => {
  // 确保每个测试之间清理 DOM
  afterEach(() => cleanup());
  it('并排展示 visual 与 headless 两个步骤队列', () => {
    const { container, getByText } = render(
      h(ScenarioHud, {
        title: '砍树',
        sessionStatus: 'running',
        currentSpeed: SimSpeed.Normal,
        currentSpeedLabel: '1x',
        visualSteps: [{ title: '下达砍树指令', status: 'running' }],
        shadowSteps: [{ title: '下达砍树指令', status: 'passed' }],
        divergence: null,
      }),
    );

    expect(getByText('Visual Runner')).toBeTruthy();
    expect(getByText('Shadow Headless Runner')).toBeTruthy();
    expect(getByText('Scenario: 砍树')).toBeTruthy();
    expect(getByText('无分歧')).toBeTruthy();
    expect((container.firstElementChild as HTMLElement | null)?.style.fontFamily).toContain('Microsoft YaHei UI');
  });

  it('有分歧时展示分歧面板', () => {
    const { getByText } = render(
      h(ScenarioHud, {
        title: '砍树',
        sessionStatus: 'completed',
        currentSpeed: SimSpeed.Paused,
        currentSpeedLabel: 'Paused',
        visualSteps: [],
        shadowSteps: [],
        divergence: {
          level: 'error',
          field: 'pawns[p1].jobDefId',
          visualValue: null,
          headlessValue: 'job_cut',
          tick: 10,
        },
      }),
    );

    expect(getByText(/pawns\[p1\]\.jobDefId/)).toBeTruthy();
    expect(getByText(/error/)).toBeTruthy();
  });

  it('ready 状态下展示 Start 按钮，不展示步进控件', () => {
    const onStart = vi.fn();
    const { getByRole, queryByRole, getByText } = render(
      h(ScenarioHud, {
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
        onStart,
      }),
    );

    fireEvent.click(getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    // ready 状态不显示步进按钮
    expect(queryByRole('button', { name: '+1 tick' })).toBeNull();
    expect(getByText('Status: ready')).toBeTruthy();
  });

  it('paused 状态下展示调试控件并触发步进回调', () => {
    const onStepTicks = vi.fn();
    const onRunToNextGate = vi.fn();
    const onResume = vi.fn();
    const { getByRole, getByText } = render(
      h(ScenarioHud, {
        scenarioId: 'warehouse-storage-haul',
        title: '搬运进仓库',
        sessionStatus: 'paused',
        currentTick: 42,
        currentSpeed: SimSpeed.Paused,
        currentSpeedLabel: 'Paused',
        currentStepTitle: '等待木材进入仓库',
        visualSteps: [{ title: '等待木材进入仓库', status: 'running' }],
        shadowSteps: [{ title: '等待木材进入仓库', status: 'passed' }],
        divergence: null,
        onResume,
        onStepTicks,
        onRunToNextGate,
      }),
    );

    fireEvent.click(getByRole('button', { name: '+1 tick' }));
    fireEvent.click(getByRole('button', { name: '+10 ticks' }));
    fireEvent.click(getByRole('button', { name: 'Run to Next Gate' }));
    fireEvent.click(getByRole('button', { name: 'Resume' }));

    expect(onStepTicks).toHaveBeenNthCalledWith(1, 1);
    expect(onStepTicks).toHaveBeenNthCalledWith(2, 10);
    expect(onRunToNextGate).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(getByText('Tick: 42')).toBeTruthy();
    expect(getByText('Speed: Paused')).toBeTruthy();
  });

  it('running 状态下展示 Pause 按钮', () => {
    const onPause = vi.fn();
    const { getAllByRole, queryByRole } = render(
      h(ScenarioHud, {
        title: '砍树',
        sessionStatus: 'running',
        currentTick: 10,
        currentSpeed: SimSpeed.Normal,
        currentSpeedLabel: '1x',
        visualSteps: [],
        shadowSteps: [],
        divergence: null,
        onPause,
      }),
    );

    // running 状态同时存在 ActionBar 的 Pause 和 TimeControls 的 Pause 速度按钮
    const pauseButtons = getAllByRole('button', { name: 'Pause' });
    expect(pauseButtons.length).toBeGreaterThanOrEqual(1);
    // 点击 ActionBar 的 Pause 按钮（第一个）
    fireEvent.click(pauseButtons[0]);
    expect(onPause).toHaveBeenCalledTimes(1);
    // running 状态不显示 Start
    expect(queryByRole('button', { name: 'Start' })).toBeNull();
  });

  it('completed 状态下展示 Restart 和 Back to Scenarios', () => {
    const onRestart = vi.fn();
    const onBackToScenarios = vi.fn();
    const { getByRole } = render(
      h(ScenarioHud, {
        title: '砍树',
        sessionStatus: 'completed',
        currentSpeed: SimSpeed.Paused,
        currentSpeedLabel: 'Paused',
        visualSteps: [],
        shadowSteps: [],
        divergence: null,
        onRestart,
        onBackToScenarios,
      }),
    );

    fireEvent.click(getByRole('button', { name: 'Restart' }));
    fireEvent.click(getByRole('button', { name: 'Back to Scenarios' }));
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onBackToScenarios).toHaveBeenCalledTimes(1);
  });
});
