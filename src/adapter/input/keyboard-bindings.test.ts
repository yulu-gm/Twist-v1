/**
 * @file keyboard-bindings.test.ts
 * @description 键盘绑定测试 — 覆盖 Esc 退层 / 根层 Esc 切换 select / 动态字母快捷键
 * @part-of adapter/input
 */

import { describe, expect, it } from 'vitest';
import { setupKeyboardBindings } from './keyboard-bindings';
import {
  ToolType,
  createPresentationState,
  enterCommandMenuBranch,
} from '../../presentation/presentation-state';

interface FakeKeyboardScene {
  input: {
    keyboard: {
      on(event: string, handler: (event?: KeyboardEvent) => void): void;
    };
  };
  __listeners: Record<string, Array<(event?: KeyboardEvent) => void>>;
}

function createFakeScene(): FakeKeyboardScene {
  const listeners: Record<string, Array<(event?: KeyboardEvent) => void>> = {};
  return {
    input: {
      keyboard: {
        on(event: string, handler: (event?: KeyboardEvent) => void) {
          listeners[event] ??= [];
          listeners[event].push(handler);
        },
      },
    },
    __listeners: listeners,
  };
}

function fakeWorld() {
  return { commandQueue: [], speed: 1 } as any;
}

describe('keyboard-bindings command menu integration', () => {
  it('pops commandMenuPath on Esc before resetting tool', () => {
    const scene = createFakeScene();
    const world = fakeWorld();
    const presentation = createPresentationState();
    presentation.activeTool = ToolType.Build;
    presentation.activeBuildDefId = 'wall_wood' as any;
    enterCommandMenuBranch(presentation, 'build');
    enterCommandMenuBranch(presentation, 'structure');

    setupKeyboardBindings(scene as any, world, presentation);
    scene.__listeners['keydown-ESC'][0]();

    expect(presentation.commandMenuPath).toEqual(['build']);
    expect(presentation.activeTool).toBe(ToolType.Build);
    expect(presentation.activeBuildDefId).toBe('wall_wood');
  });

  it('resets to select tool on root Esc', () => {
    const scene = createFakeScene();
    const world = fakeWorld();
    const presentation = createPresentationState();
    presentation.activeTool = ToolType.Build;
    presentation.activeBuildDefId = 'wall_wood' as any;

    setupKeyboardBindings(scene as any, world, presentation);
    scene.__listeners['keydown-ESC'][0]();

    expect(presentation.commandMenuPath).toEqual([]);
    expect(presentation.activeTool).toBe(ToolType.Select);
    expect(presentation.activeBuildDefId).toBeNull();
  });

  it('uses visible menu shortcuts to descend into branches instead of legacy fixed tool hotkeys', () => {
    const scene = createFakeScene();
    const world = fakeWorld();
    const presentation = createPresentationState();
    enterCommandMenuBranch(presentation, 'build');

    setupKeyboardBindings(scene as any, world, presentation);
    // 在 build 层中条目为 [返回(Esc), 结构(Z), 家具(X)]，按 Z 应进入结构子层
    scene.__listeners['keydown-Z'][0]();

    expect(presentation.commandMenuPath).toEqual(['build', 'structure']);
    // 进入分支不会切换工具
    expect(presentation.activeTool).toBe(ToolType.Select);
  });

  it('activates leaf entries from the current level without changing menu path', () => {
    const scene = createFakeScene();
    const world = fakeWorld();
    const presentation = createPresentationState();
    enterCommandMenuBranch(presentation, 'designate');

    setupKeyboardBindings(scene as any, world, presentation);
    // designate 层条目 [返回(Esc), 采矿(Z), 收获(X), 砍伐(C)] — 按 X 触发收获
    scene.__listeners['keydown-X'][0]();

    expect(presentation.commandMenuPath).toEqual(['designate']);
    expect(presentation.activeTool).toBe(ToolType.Designate);
    expect(presentation.activeDesignationType).toBe('harvest');
  });

  it('activates root leaves without entering any branch', () => {
    const scene = createFakeScene();
    const world = fakeWorld();
    const presentation = createPresentationState();

    setupKeyboardBindings(scene as any, world, presentation);
    // 根层条目 [选择(Z), 建造(X), 指令(C), 区域(V), 取消(B)] — 按 B 触发取消
    scene.__listeners['keydown-B'][0]();

    expect(presentation.commandMenuPath).toEqual([]);
    expect(presentation.activeTool).toBe(ToolType.Cancel);
  });
});
