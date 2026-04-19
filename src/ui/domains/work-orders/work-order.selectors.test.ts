/**
 * @file work-order.selectors.test.ts
 * @description selectWorkOrderBoard 测试 — 验证 displayPhase 派生、hidden 过滤、suggestedExpanded
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import { describe, expect, it } from 'vitest';
import type { EngineSnapshot, UiState, WorkOrderNode } from '../../kernel/ui-types';
import { selectWorkOrderBoard } from './work-order.selectors';
import type { CompletionTrackerState } from './use-completion-tracker';

/** 构造空但合法的快照 */
function makeSnapshot(orders: WorkOrderNode[]): EngineSnapshot {
  const byId: Record<string, WorkOrderNode> = {};
  for (const o of orders) byId[o.id] = o;
  return {
    workOrders: { list: orders, byId },
  } as unknown as EngineSnapshot;
}

function makeOrder(id: string, status: WorkOrderNode['status'], priority = 0): WorkOrderNode {
  return {
    id,
    title: id,
    sourceKind: 'map',
    orderKind: 'cut',
    priorityIndex: priority,
    status,
    blocked: false,
    totalItemCount: 1,
    doneItemCount: status === 'done' ? 1 : 0,
    activeWorkerCount: 0,
    items: [],
  };
}

const emptyUi = { inspectorTargetId: null } as unknown as UiState;
const emptyCompletion: CompletionTrackerState = {
  completingDoneAt: new Map(),
  exitingIds: new Set(),
  exitingStartAt: new Map(),
  hiddenIds: new Set(),
};

describe('selectWorkOrderBoard', () => {
  it('marks displayPhase=normal for active orders', () => {
    const vm = selectWorkOrderBoard(
      makeSnapshot([makeOrder('a', 'active')]),
      emptyUi,
      emptyCompletion,
    );
    expect(vm.rows).toHaveLength(1);
    expect(vm.rows[0].displayPhase).toBe('normal');
    expect(vm.suggestedExpanded).toBe(true);
  });

  it('marks displayPhase=completing for done orders in completingDoneAt', () => {
    const completion: CompletionTrackerState = {
      completingDoneAt: new Map([['a', 1000]]),
      exitingIds: new Set(),
      exitingStartAt: new Map(),
      hiddenIds: new Set(),
    };
    const vm = selectWorkOrderBoard(
      makeSnapshot([makeOrder('a', 'done')]),
      emptyUi,
      completion,
    );
    expect(vm.rows[0].displayPhase).toBe('completing');
  });

  it('marks displayPhase=exiting when id in exitingIds', () => {
    const completion: CompletionTrackerState = {
      completingDoneAt: new Map([['a', 1000]]),
      exitingIds: new Set(['a']),
      exitingStartAt: new Map([['a', 3000]]),
      hiddenIds: new Set(),
    };
    const vm = selectWorkOrderBoard(
      makeSnapshot([makeOrder('a', 'done')]),
      emptyUi,
      completion,
    );
    expect(vm.rows[0].displayPhase).toBe('exiting');
  });

  it('filters out rows whose id is in hiddenIds', () => {
    const completion: CompletionTrackerState = {
      completingDoneAt: new Map(),
      exitingIds: new Set(),
      exitingStartAt: new Map(),
      hiddenIds: new Set(['a']),
    };
    const vm = selectWorkOrderBoard(
      makeSnapshot([makeOrder('a', 'done'), makeOrder('b', 'active')]),
      emptyUi,
      completion,
    );
    expect(vm.rows.map(r => r.id)).toEqual(['b']);
  });

  it('suggestedExpanded reflects post-filter row count', () => {
    const completion: CompletionTrackerState = {
      completingDoneAt: new Map(),
      exitingIds: new Set(),
      exitingStartAt: new Map(),
      hiddenIds: new Set(['a']),
    };
    const vm = selectWorkOrderBoard(
      makeSnapshot([makeOrder('a', 'done')]),
      emptyUi,
      completion,
    );
    expect(vm.rows).toHaveLength(0);
    expect(vm.suggestedExpanded).toBe(false);
  });
});
