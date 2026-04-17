/**
 * @file work-order-board.test.tsx
 * @description WorkOrderBoard 组件测试 — 验证行渲染、选中态、暂停/取消按钮派发
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { WorkOrderBoard } from './work-order-board';

describe('WorkOrderBoard', () => {
  it('renders rows and dispatches pause / cancel actions', () => {
    const onPause = vi.fn();
    const onCancel = vi.fn();

    render(
      <WorkOrderBoard
        rows={[{
          id: 'wo_1',
          title: '砍伐 5 棵树',
          sourceKind: 'map',
          priorityIndex: 0,
          progressLabel: '0 / 5',
          activeWorkerLabel: '2 人',
          blocked: false,
          status: 'active',
        }]}
        selectedOrderId="wo_1"
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
});
