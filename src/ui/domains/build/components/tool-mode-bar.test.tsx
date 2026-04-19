/**
 * @file tool-mode-bar.test.tsx
 * @description ToolModeBar 组件测试 — 验证统一方块列表渲染、返回项、分支进入、叶子激活
 * @part-of ui/domains/build — 建造 UI 领域
 */

import { fireEvent, render, screen, cleanup } from '@testing-library/preact';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ToolModeBar } from './tool-mode-bar';
import type { CommandMenuViewModel } from '../build.types';

afterEach(cleanup);

function renderBar(menu: CommandMenuViewModel, overrides: Partial<Parameters<typeof ToolModeBar>[0]> = {}) {
  return render(
    <ToolModeBar
      menu={menu}
      onActivate={vi.fn()}
      onEnterBranch={vi.fn()}
      onBack={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ToolModeBar', () => {
  it('renders root entries as square command tiles with shortcut hints', () => {
    renderBar({
      path: [],
      entries: [
        { id: 'select', label: '选择', shortcut: 'Z', kind: 'leaf', active: true, action: { id: 'select', tool: 'select', label: '选择', hotkey: '', group: 0 } },
        { id: 'build', label: '建造', shortcut: 'X', kind: 'branch', active: false, branchId: 'build' },
      ],
    });

    expect(screen.getByRole('button', { name: '选择' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '建造' })).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('marks active entries with is-active class', () => {
    renderBar({
      path: [],
      entries: [
        { id: 'select', label: '选择', shortcut: 'Z', kind: 'leaf', active: true, action: { id: 'select', tool: 'select', label: '选择', hotkey: '', group: 0 } },
      ],
    });

    expect(screen.getByRole('button', { name: '选择' }).className).toContain('is-active');
  });

  it('calls onEnterBranch for branch tiles', () => {
    const onEnterBranch = vi.fn();
    renderBar(
      {
        path: [],
        entries: [{ id: 'build', label: '建造', shortcut: 'X', kind: 'branch', active: false, branchId: 'build' }],
      },
      { onEnterBranch },
    );

    fireEvent.click(screen.getByRole('button', { name: '建造' }));
    expect(onEnterBranch).toHaveBeenCalledWith('build');
  });

  it('calls onBack for 返回 tiles', () => {
    const onBack = vi.fn();
    renderBar(
      {
        path: ['build'],
        entries: [{ id: '__back__', label: '返回', shortcut: 'Esc', kind: 'back', active: false }],
      },
      { onBack },
    );

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onActivate for leaf tiles without requiring local menu state', () => {
    const onActivate = vi.fn();
    renderBar(
      {
        path: ['build', 'structure'],
        entries: [{ id: 'build_wall', label: '墙', shortcut: 'Z', kind: 'leaf', active: true, action: { id: 'build_wall', tool: 'build', label: '墙', hotkey: '', buildDefId: 'wall_wood', group: 1 } }],
      },
      { onActivate },
    );

    fireEvent.click(screen.getByRole('button', { name: '墙' }));
    expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ id: 'build_wall', buildDefId: 'wall_wood' }));
  });
});
