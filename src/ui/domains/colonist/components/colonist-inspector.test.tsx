/**
 * @file colonist-inspector.test.tsx
 * @description 殖民者检查器组件测试 — 验证名称、任务、需求条和生命值的渲染
 * @part-of ui/domains/colonist — 殖民者 UI 领域
 */

import { render, screen, cleanup } from '@testing-library/preact';
import { describe, expect, it, afterEach } from 'vitest';
import { ColonistInspector } from './colonist-inspector';
import type { ColonistInspectorViewModel } from '../colonist.types';

afterEach(cleanup);

/** 构造测试用检查器视图模型，可覆盖任意字段 */
function makeViewModel(overrides: Partial<ColonistInspectorViewModel> = {}): ColonistInspectorViewModel {
  return {
    id: 'pawn_1',
    name: 'Alice',
    cell: { x: 5, y: 10 },
    factionId: 'player',
    jobLabel: 'Constructing wall',
    health: { hp: 80, maxHp: 100 },
    needs: [
      { key: 'food', label: 'Food', value: 62, color: '#cc8844' },
      { key: 'rest', label: 'Rest', value: 41, color: '#4488cc' },
    ],
    ...overrides,
  };
}

describe('ColonistInspector', () => {
  it('renders the colonist name', () => {
    render(<ColonistInspector viewModel={makeViewModel()} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders the current job label', () => {
    render(<ColonistInspector viewModel={makeViewModel()} />);
    expect(screen.getByText('Constructing wall')).toBeInTheDocument();
  });

  it('renders need bar labels', () => {
    render(<ColonistInspector viewModel={makeViewModel()} />);
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Rest')).toBeInTheDocument();
  });

  it('renders health info', () => {
    render(<ColonistInspector viewModel={makeViewModel()} />);
    expect(screen.getByText('80/100')).toBeInTheDocument();
  });
});
