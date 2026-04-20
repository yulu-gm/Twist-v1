/**
 * @file object-inspector.test.tsx
 * @description ObjectInspector 组件测试
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObjectInspector } from './object-inspector';
import type { GenericInspectorViewModel, SpecializedInspectorViewModel } from '../inspector.types';

describe('ObjectInspector', () => {
  afterEach(cleanup);
  it('renders the fallback notice for generic inspector', () => {
    const vm: GenericInspectorViewModel = {
      mode: 'generic',
      targetId: 'mystery_1',
      title: 'Mystery Object',
      subtitle: 'mystery',
      stack: [{ id: 'mystery_1', label: 'Mystery Object', kind: 'mystery', isActive: true }],
      fallbackNotice: '该对象尚未实现专用 Inspector，当前显示的是通用兜底信息。',
      stats: [
        { label: 'Kind', value: 'mystery' },
        { label: 'Def', value: 'mystery_def' },
      ],
    };

    render(
      <ObjectInspector viewModel={vm} onSelectTarget={() => {}} onRunAction={() => {}} />,
    );

    expect(screen.getByTestId('fallback-notice')).toBeInTheDocument();
    expect(screen.getByText('该对象尚未实现专用 Inspector，当前显示的是通用兜底信息。')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-title').textContent).toBe('Mystery Object');
  });

  it('renders specialized sections and actions', () => {
    const vm: SpecializedInspectorViewModel = {
      mode: 'specialized',
      targetId: 'bp_1',
      title: 'Blueprint: wall_wood',
      subtitle: 'Blueprint',
      stack: [{ id: 'bp_1', label: 'Blueprint: wall_wood', kind: 'blueprint', isActive: true }],
      sections: [
        { id: 'materials', title: 'Materials', rows: [{ label: 'Wood', value: '4/10' }] },
      ],
      actions: [
        { id: 'cancel_construction', label: 'Cancel Construction', enabled: true },
      ],
    };

    render(
      <ObjectInspector viewModel={vm} onSelectTarget={() => {}} onRunAction={vi.fn()} />,
    );

    expect(screen.getByTestId('section-materials')).toBeInTheDocument();
    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByTestId('action-cancel_construction')).toBeInTheDocument();
  });

  it('renders stack tabs even when only one object (always visible)', () => {
    const vm: GenericInspectorViewModel = {
      mode: 'generic',
      targetId: 'item_1',
      title: 'Wood',
      subtitle: 'item',
      stack: [{ id: 'item_1', label: 'Wood', kind: 'item', isActive: true }],
      fallbackNotice: '该对象尚未实现专用 Inspector，当前显示的是通用兜底信息。',
      stats: [],
    };

    render(
      <ObjectInspector viewModel={vm} onSelectTarget={() => {}} onRunAction={() => {}} />,
    );

    expect(screen.getByTestId('object-stack-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('stack-tab-item_1')).toBeInTheDocument();
  });

  it('renders stack tabs when multiple objects exist', () => {
    const vm: GenericInspectorViewModel = {
      mode: 'generic',
      targetId: 'building_1',
      title: 'Wood Wall',
      subtitle: 'building',
      stack: [
        { id: 'building_1', label: 'Wood Wall', kind: 'building', isActive: true },
        { id: 'item_1', label: 'Wood', kind: 'item', isActive: false },
      ],
      fallbackNotice: '该对象尚未实现专用 Inspector，当前显示的是通用兜底信息。',
      stats: [],
    };

    render(
      <ObjectInspector viewModel={vm} onSelectTarget={() => {}} onRunAction={() => {}} />,
    );

    expect(screen.getByTestId('object-stack-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('stack-tab-building_1')).toBeInTheDocument();
    expect(screen.getByTestId('stack-tab-item_1')).toBeInTheDocument();
  });

  it('renders warehouse inventory dock inside specialized inspector body', () => {
    const vm: SpecializedInspectorViewModel = {
      mode: 'specialized',
      targetId: 'warehouse_1',
      title: 'Warehouse',
      subtitle: 'Building',
      stack: [{ id: 'warehouse_1', label: 'Warehouse', kind: 'building', isActive: true }],
      sections: [],
      actions: [],
      renderBody: () => (
        <div class="warehouse-inspector">
          <div class="warehouse-inspector__top">top</div>
          <div class="warehouse-inventory">
            <div class="warehouse-inventory__grid" data-testid="warehouse-inventory-grid">grid</div>
          </div>
        </div>
      ),
    };

    render(<ObjectInspector viewModel={vm} onSelectTarget={() => {}} onRunAction={() => {}} />);
    expect(screen.getByTestId('warehouse-inventory-grid')).toBeInTheDocument();
  });
});