/**
 * @file tool-mode-bar.test.tsx
 * @description 工具栏组件测试 — 验证按钮渲染、高亮状态和点击回调
 * @part-of ui/domains/build — 建造 UI 领域
 */

import { fireEvent, render, screen, cleanup } from '@testing-library/preact';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ToolModeBar } from './tool-mode-bar';
import { toolActions } from '../build.schemas';

afterEach(cleanup);

describe('ToolModeBar', () => {
  it('renders all tool buttons', () => {
    render(<ToolModeBar activeToolId="select" onActivate={vi.fn()} />);
    for (const action of toolActions) {
      expect(screen.getByRole('button', { name: action.label })).toBeInTheDocument();
    }
  });

  it('highlights the active tool', () => {
    render(<ToolModeBar activeToolId="mine" onActivate={vi.fn()} />);
    const mineBtn = screen.getByRole('button', { name: 'Mine' });
    expect(mineBtn.className).toContain('is-active');
  });

  it('calls onActivate when a tool is clicked', () => {
    const onActivate = vi.fn();
    render(<ToolModeBar activeToolId="select" onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wall' }));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate.mock.calls[0][0].id).toBe('build');
  });
});
