/**
 * @file building-inspector.test.tsx
 * @description 建筑检查器组件测试 — 验证通用建筑信息和床位所有者控件的渲染与交互
 * @part-of ui/domains/building — 建筑 UI 领域
 */

import { render, screen, cleanup } from '@testing-library/preact';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { BuildingInspector } from './building-inspector';
import type { BuildingInspectorViewModel } from '../building.types';

afterEach(cleanup);

describe('BuildingInspector', () => {
  it('renders generic building info', () => {
    const vm: BuildingInspectorViewModel = {
      kind: 'generic',
      base: { id: 'wall_1', label: 'Wood Wall', stats: [{ label: 'Type', value: 'Structure' }] },
    };
    render(<BuildingInspector viewModel={vm} />);
    expect(screen.getByText('Wood Wall')).toBeInTheDocument();
    expect(screen.getByText('Structure')).toBeInTheDocument();
  });

  it('renders bed owner and occupant labels', () => {
    const vm: BuildingInspectorViewModel = {
      kind: 'bed',
      base: { id: 'bed_1', label: 'Wood Bed', stats: [{ label: 'Type', value: 'Bed' }] },
      detail: {
        role: 'Owned',
        ownerLabel: 'Alice',
        occupantLabel: 'Empty',
        availableOwners: [{ id: 'pawn_1', label: 'Alice' }],
      },
    };
    render(<BuildingInspector viewModel={vm} onAssignOwner={vi.fn()} onClearOwner={vi.fn()} />);
    // 'Alice' appears both in the Owner stat row and the dropdown option
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('calls onAssignOwner when selecting an owner from dropdown', async () => {
    const onAssignOwner = vi.fn();
    const vm: BuildingInspectorViewModel = {
      kind: 'bed',
      base: { id: 'bed_1', label: 'Wood Bed', stats: [] },
      detail: {
        role: 'Public',
        ownerLabel: 'Unassigned',
        occupantLabel: 'Empty',
        availableOwners: [{ id: 'pawn_1', label: 'Alice' }, { id: 'pawn_2', label: 'Bob' }],
      },
    };
    render(<BuildingInspector viewModel={vm} onAssignOwner={onAssignOwner} onClearOwner={vi.fn()} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    // Simulate selecting 'pawn_1'
    select.value = 'pawn_1';
    select.dispatchEvent(new Event('input', { bubbles: true }));

    expect(onAssignOwner).toHaveBeenCalledWith('bed_1', 'pawn_1');
  });

  it('calls onClearOwner when clicking clear button', () => {
    const onClearOwner = vi.fn();
    const vm: BuildingInspectorViewModel = {
      kind: 'bed',
      base: { id: 'bed_1', label: 'Wood Bed', stats: [] },
      detail: {
        role: 'Owned',
        ownerLabel: 'Alice',
        occupantLabel: 'Empty',
        availableOwners: [{ id: 'pawn_1', label: 'Alice' }],
      },
    };
    render(<BuildingInspector viewModel={vm} onAssignOwner={vi.fn()} onClearOwner={onClearOwner} />);

    screen.getByRole('button', { name: /clear/i }).click();
    expect(onClearOwner).toHaveBeenCalledWith('bed_1');
  });
});
