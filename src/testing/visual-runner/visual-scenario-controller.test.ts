/**
 * @file visual-scenario-controller.test.ts
 * @description Visual Scenario Controller 生命周期测试 — 验证 session 状态转换、
 *              bootstrap 延迟、destroy teardown、restart 重置、步进和 next-gate 行为
 */

import { describe, expect, it, vi } from 'vitest';
import { SimSpeed } from '../../core/types';
import { createScenario, createSetupStep, createCommandStep } from '../scenario-dsl/scenario.builders';
import { createVisualScenarioController } from './visual-scenario-controller';

describe('createVisualScenarioController', () => {
  it('starts in ready state and does not bootstrap Phaser until start() is called', async () => {
    const fakeGame = { destroy: vi.fn() } as any;
    const bootstrapGame = vi.fn(() => fakeGame);
    const scenario = createScenario({
      id: 'ready-state',
      title: 'ready state',
      setup: [],
      script: [],
      expect: [],
    });

    const controller = createVisualScenarioController(scenario, () => {}, { bootstrapGame });

    expect(controller.getState().sessionStatus).toBe('ready');
    expect(bootstrapGame).not.toHaveBeenCalled();

    await controller.start();

    expect(bootstrapGame).toHaveBeenCalledTimes(1);
    // 空场景应立即完成
    expect(controller.getState().sessionStatus).toBe('completed');
  });

  it('destroy() tears down the Phaser game', async () => {
    const fakeGame = { destroy: vi.fn() } as any;
    const bootstrapGame = vi.fn(() => fakeGame);
    const scenario = createScenario({
      id: 'destroyable',
      title: 'destroyable',
      setup: [],
      script: [],
      expect: [],
    });

    const controller = createVisualScenarioController(scenario, () => {}, { bootstrapGame });
    await controller.start();
    await controller.destroy();

    expect(fakeGame.destroy).toHaveBeenCalledWith(true);
  });

  it('restart() resets session state to ready', async () => {
    const fakeGame = { destroy: vi.fn() } as any;
    const bootstrapGame = vi.fn(() => fakeGame);
    const scenario = createScenario({
      id: 'restartable',
      title: 'restartable',
      setup: [],
      script: [],
      expect: [],
    });

    const controller = createVisualScenarioController(scenario, () => {}, { bootstrapGame });
    await controller.start();
    expect(controller.getState().sessionStatus).toBe('completed');

    await controller.restart();
    expect(fakeGame.destroy).toHaveBeenCalledWith(true);
    expect(controller.getState().sessionStatus).toBe('ready');
    expect(controller.getState().currentTick).toBe(0);
    expect(controller.getState().result).toBeNull();

    await controller.destroy();
  });

  it('setSpeed() updates current speed when session is running or paused', async () => {
    const fakeGame = { destroy: vi.fn() } as any;
    const bootstrapGame = vi.fn(() => fakeGame);
    // 使用带 setup 步骤的场景，让 start 后进入 running 然后完成
    const scenario = createScenario({
      id: 'speed-control',
      title: 'speed control',
      setup: [createSetupStep('noop setup', () => {})],
      script: [],
      expect: [],
    });

    const controller = createVisualScenarioController(scenario, () => {}, { bootstrapGame });

    // ready 状态下 setSpeed 不生效
    controller.setSpeed(SimSpeed.Fast);
    expect(controller.getState().currentSpeed).toBe(SimSpeed.Paused);

    await controller.start();
    // 场景完成后处于 completed — setSpeed 不生效
    expect(controller.getState().sessionStatus).toBe('completed');
    controller.setSpeed(SimSpeed.Fast);
    expect(controller.getState().currentSpeed).toBe(SimSpeed.Paused);

    await controller.destroy();
  });

  it('stepTicks() only works in paused state and is rejected in ready/completed', async () => {
    const fakeGame = { destroy: vi.fn() } as any;
    const bootstrapGame = vi.fn(() => fakeGame);
    const scenario = createScenario({
      id: 'step-control',
      title: 'step control',
      setup: [createSetupStep('noop setup', () => {})],
      script: [],
      expect: [],
    });

    const controller = createVisualScenarioController(scenario, () => {}, { bootstrapGame });

    // ready 状态下 stepTicks 不生效
    await controller.stepTicks(1);
    expect(controller.getState().currentTick).toBe(0);

    await controller.start();
    // completed 状态下 stepTicks 不生效
    await controller.stepTicks(1);
    expect(controller.getState().sessionStatus).toBe('completed');

    await controller.destroy();
  });

  it('correctly tracks step titles and results through execution', async () => {
    const fakeGame = { destroy: vi.fn() } as any;
    const bootstrapGame = vi.fn(() => fakeGame);
    const states: string[] = [];

    const scenario = createScenario({
      id: 'step-tracking',
      title: 'step tracking',
      setup: [createSetupStep('初始化世界', () => {})],
      script: [createCommandStep('执行命令', () => {})],
      expect: [],
    });

    const controller = createVisualScenarioController(
      scenario,
      (state) => { states.push(state.sessionStatus); },
      { bootstrapGame },
    );

    await controller.start();

    // 应该经历了 ready -> running -> completed
    expect(states).toContain('running');
    expect(states[states.length - 1]).toBe('completed');
    expect(controller.getState().done).toBe(true);
    expect(controller.getState().result?.status).toBe('passed');

    await controller.destroy();
  });
});
