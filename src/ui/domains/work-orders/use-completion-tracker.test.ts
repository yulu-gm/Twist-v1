/**
 * @file use-completion-tracker.test.ts
 * @description useCompletionTracker hook 测试 — 验证完成淡出窗口的时间推进
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import { renderHook, act } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkOrderNode } from '../../kernel/ui-types';
import { useCompletionTracker } from './use-completion-tracker';

/** 构造一个最小 WorkOrderNode，用于驱动 hook 输入 */
function makeNode(id: string, status: WorkOrderNode['status']): WorkOrderNode {
  return {
    id,
    title: id,
    sourceKind: 'map',
    orderKind: 'cut',
    priorityIndex: 0,
    status,
    blocked: false,
    totalItemCount: 1,
    doneItemCount: status === 'done' ? 1 : 0,
    activeWorkerCount: 0,
    items: [],
  };
}

describe('useCompletionTracker', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('marks done order as completing immediately, then exiting after 2000ms, then hidden after another 240ms', () => {
    const t0 = 1_000_000;
    vi.setSystemTime(t0);
    const { result, rerender } = renderHook(
      ({ orders }: { orders: WorkOrderNode[] }) => useCompletionTracker(orders),
      { initialProps: { orders: [makeNode('wo_1', 'done')] } },
    );

    expect(result.current.completingDoneAt.get('wo_1')).toBe(t0);
    expect(result.current.exitingIds.has('wo_1')).toBe(false);
    expect(result.current.hiddenIds.has('wo_1')).toBe(false);

    act(() => { vi.advanceTimersByTime(2000); });
    rerender({ orders: [makeNode('wo_1', 'done')] });
    expect(result.current.exitingIds.has('wo_1')).toBe(true);
    expect(result.current.hiddenIds.has('wo_1')).toBe(false);

    act(() => { vi.advanceTimersByTime(240); });
    rerender({ orders: [makeNode('wo_1', 'done')] });
    expect(result.current.hiddenIds.has('wo_1')).toBe(true);
  });

  it('cancelled order skips completing, goes straight to exiting then hidden', () => {
    const t0 = 2_000_000;
    vi.setSystemTime(t0);
    const { result, rerender } = renderHook(
      ({ orders }: { orders: WorkOrderNode[] }) => useCompletionTracker(orders),
      { initialProps: { orders: [makeNode('wo_2', 'cancelled')] } },
    );

    expect(result.current.completingDoneAt.has('wo_2')).toBe(false);
    expect(result.current.exitingIds.has('wo_2')).toBe(true);
    expect(result.current.hiddenIds.has('wo_2')).toBe(false);

    act(() => { vi.advanceTimersByTime(240); });
    rerender({ orders: [makeNode('wo_2', 'cancelled')] });
    expect(result.current.hiddenIds.has('wo_2')).toBe(true);
  });

  it('keeps separate timers for multiple terminal orders', () => {
    const t0 = 3_000_000;
    vi.setSystemTime(t0);
    const { result, rerender } = renderHook(
      ({ orders }: { orders: WorkOrderNode[] }) => useCompletionTracker(orders),
      { initialProps: { orders: [makeNode('a', 'done')] } },
    );

    act(() => { vi.advanceTimersByTime(1000); });
    rerender({ orders: [makeNode('a', 'done'), makeNode('b', 'done')] });
    expect(result.current.completingDoneAt.get('a')).toBe(t0);
    expect(result.current.completingDoneAt.get('b')).toBe(t0 + 1000);

    act(() => { vi.advanceTimersByTime(1000); });
    rerender({ orders: [makeNode('a', 'done'), makeNode('b', 'done')] });
    expect(result.current.exitingIds.has('a')).toBe(true);
    expect(result.current.exitingIds.has('b')).toBe(false);
  });
});
