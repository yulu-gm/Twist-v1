/**
 * @file shadow-runner.test.ts
 * @description Shadow Runner diff 逻辑测试
 */

import { describe, expect, it } from 'vitest';
import { diffCheckpointSnapshots } from './shadow-runner';
import type { CheckpointSnapshot } from '../scenario-harness/checkpoint-snapshot';

function makeSnapshot(overrides?: Partial<CheckpointSnapshot>): CheckpointSnapshot {
  return {
    tick: 10,
    pawns: [],
    items: [],
    designations: [],
    blueprints: [],
    buildings: [],
    workOrders: { list: [], byTitle: {} },
    ...overrides,
  };
}

describe('diffCheckpointSnapshots', () => {
  it('相同快照返回 null', () => {
    const a = makeSnapshot();
    const b = makeSnapshot();
    expect(diffCheckpointSnapshots(a, b)).toBeNull();
  });

  it('tick 不同时返回 error', () => {
    const a = makeSnapshot({ tick: 10 });
    const b = makeSnapshot({ tick: 11 });
    const result = diffCheckpointSnapshots(a, b);
    expect(result?.field).toBe('tick');
    expect(result?.level).toBe('error');
  });

  it('pawn jobDefId 不同时返回 error', () => {
    const a = makeSnapshot({
      pawns: [{ id: 'p1', name: 'Test', cell: { x: 0, y: 0 }, jobId: null, jobDefId: null, food: 100, rest: 100 }],
    });
    const b = makeSnapshot({
      pawns: [{ id: 'p1', name: 'Test', cell: { x: 0, y: 0 }, jobId: 'j1', jobDefId: 'job_cut', food: 100, rest: 100 }],
    });
    const result = diffCheckpointSnapshots(a, b);
    expect(result?.field).toBe('pawns[p1].jobDefId');
    expect(result?.level).toBe('error');
  });

  it('pawn 位置不同时返回 warning', () => {
    const a = makeSnapshot({
      pawns: [{ id: 'p1', name: 'Test', cell: { x: 5, y: 5 }, jobId: null, jobDefId: null, food: 100, rest: 100 }],
    });
    const b = makeSnapshot({
      pawns: [{ id: 'p1', name: 'Test', cell: { x: 6, y: 5 }, jobId: null, jobDefId: null, food: 100, rest: 100 }],
    });
    const result = diffCheckpointSnapshots(a, b);
    expect(result?.field).toBe('pawns[p1].cell');
    expect(result?.level).toBe('warning');
  });

  it('items 数量不同时返回 error', () => {
    const a = makeSnapshot({ items: [{ id: 'i1', defId: 'wood', cell: { x: 0, y: 0 }, stackCount: 5 }] });
    const b = makeSnapshot({ items: [] });
    const result = diffCheckpointSnapshots(a, b);
    expect(result?.field).toBe('items.length');
    expect(result?.level).toBe('error');
  });
});
