/**
 * @file work-order-board.test.tsx
 * @description WorkOrderBoard 组件测试 — 验证行渲染、选中态、折叠切换、完成态
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import { fireEvent, render, screen, cleanup } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkOrderBoard } from './work-order-board';
import type { WorkOrderRow } from '../work-order.types';

afterEach(cleanup);

function row(overrides: Partial<WorkOrderRow> = {}): WorkOrderRow {
  return {
    id: 'wo_1',
    title: '砍伐 5 棵树',
    sourceKind: 'map',
    priorityIndex: 0,
    progressLabel: '0 / 5',
    activeWorkerLabel: '2 人',
    blocked: false,
    status: 'active',
    displayPhase: 'normal',
    ...overrides,
  };
}

describe('WorkOrderBoard', () => {
  it('renders rows and dispatches pause / cancel actions', () => {
    const onPause = vi.fn();
    const onCancel = vi.fn();
    render(
      <WorkOrderBoard
        rows={[row()]}
        selectedOrderId="wo_1"
        expanded={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onPause={onPause}
        onResume={vi.fn()}
        onCancel={onCancel}
        detail={{
          id: 'wo_1',
          title: '砍伐 5 棵树',
          items: [{ id: 'woi_1', status: 'working', blockedReason: null, currentStage: 'cutting', claimedByPawnId: 'pawn_1' }],
        }}
      />,
    );
    expect(screen.getByText('砍伐 5 棵树')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '暂停' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onPause).toHaveBeenCalledWith('wo_1');
    expect(onCancel).toHaveBeenCalledWith('wo_1');
  });

  it('keeps body mounted but unexpanded when collapsed (so CSS can animate)', () => {
    const { container } = render(
      <WorkOrderBoard
        rows={[row()]}
        selectedOrderId={null}
        expanded={false}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        detail={null}
      />,
    );
    // 标题条仍可见
    expect(screen.getByRole('button', { name: /工作订单/ })).toBeInTheDocument();
    // body 节点持续存在（用于 CSS 折叠过渡），但不带 is-expanded
    const body = container.querySelector('.work-order-board__body');
    expect(body).not.toBeNull();
    expect(body?.className).not.toContain('is-expanded');
    expect(body?.getAttribute('aria-hidden')).toBe('true');
  });

  it('header button toggles via onToggle', () => {
    const onToggle = vi.fn();
    render(
      <WorkOrderBoard
        rows={[]}
        selectedOrderId={null}
        expanded={false}
        onToggle={onToggle}
        onSelect={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        detail={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /工作订单/ }));
    expect(onToggle).toHaveBeenCalled();
  });

  it('renders ✓ and applies completing class for displayPhase=completing', () => {
    render(
      <WorkOrderBoard
        rows={[row({ displayPhase: 'completing' })]}
        selectedOrderId={null}
        expanded={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        detail={null}
      />,
    );
    const li = screen.getByText('砍伐 5 棵树').closest('li');
    expect(li?.className).toContain('work-order-row--completing');
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('applies exiting class for displayPhase=exiting', () => {
    render(
      <WorkOrderBoard
        rows={[row({ displayPhase: 'exiting' })]}
        selectedOrderId={null}
        expanded={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        detail={null}
      />,
    );
    const li = screen.getByText('砍伐 5 棵树').closest('li');
    expect(li?.className).toContain('work-order-row--exiting');
  });
});
