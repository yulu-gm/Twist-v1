/**
 * @file ui-bridge.test.ts
 * @description 引擎快照桥接测试 — 验证快照读取、emit 通知和取消订阅
 * @part-of ui/kernel — UI 内核层
 */

import { describe, expect, it } from 'vitest';
import { createEngineSnapshotBridge } from './ui-bridge';
import type { EngineSnapshot } from './ui-types';

/** 构造测试用最小快照 */
function makeSnapshot(tick: number): EngineSnapshot {
  return {
    tick,
    speed: 1,
    clockDisplay: '',
    colonistCount: 0,
    presentation: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, activeBuildDefId: null, hoveredCell: null, selectedIds: [], showDebugPanel: false, showGrid: false },
    selection: { primaryId: null, selectedIds: [] },
    colonists: {},
    build: { activeTool: 'select', activeDesignationType: null, activeZoneType: null, lastZoneType: 'stockpile', activeBuildDefId: null, activeModeLabel: 'Select' },
    feedback: { recentEvents: [] },
    debugInfo: '',
  };
}

describe('createEngineSnapshotBridge', () => {
  it('returns the latest computed snapshot after emit', () => {
    let tick = 1;
    const bridge = createEngineSnapshotBridge(() => makeSnapshot(tick));

    expect(bridge.getSnapshot().tick).toBe(1);

    tick = 5;
    bridge.emit();
    expect(bridge.getSnapshot().tick).toBe(5);
  });

  it('notifies subscribers on emit', () => {
    let tick = 1;
    const bridge = createEngineSnapshotBridge(() => makeSnapshot(tick));

    let callCount = 0;
    bridge.subscribe(() => { callCount++; });

    bridge.emit();
    expect(callCount).toBe(1);

    bridge.emit();
    expect(callCount).toBe(2);
  });

  it('unsubscribes correctly', () => {
    const bridge = createEngineSnapshotBridge(() => makeSnapshot(0));

    let callCount = 0;
    const unsub = bridge.subscribe(() => { callCount++; });

    bridge.emit();
    expect(callCount).toBe(1);

    unsub();
    bridge.emit();
    // 取消订阅后不再收到通知
    expect(callCount).toBe(1);
  });
});
