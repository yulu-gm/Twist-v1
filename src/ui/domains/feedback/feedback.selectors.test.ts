/**
 * @file feedback.selectors.test.ts
 * @description 反馈选择器测试 — 验证 Toast 提取/上限、通知列表、调试面板可见性
 * @part-of ui/domains/feedback — 反馈 UI 领域
 */

import { describe, expect, it } from 'vitest';
import { selectCommandFeedback, selectDebugInfo, selectShowDebugPanel } from './feedback.selectors';
import type { EngineSnapshot } from '../../kernel/ui-types';

/** 构造测试用引擎快照，可覆盖任意字段 */
function makeSnapshot(overrides: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    tick: 1,
    speed: 1,
    clockDisplay: '',
    colonistCount: 0,
    presentation: { activeTool: 'select', activeDesignationType: null, activeBuildDefId: null, hoveredCell: null, selectedIds: [], showDebugPanel: false, showGrid: false },
    selection: { primaryId: null, selectedIds: [] },
    colonists: {},
    build: { activeTool: 'select', activeDesignationType: null, activeBuildDefId: null, activeModeLabel: 'Select' },
    feedback: { recentEvents: [] },
    debugInfo: '',
    ...overrides,
  };
}

describe('selectCommandFeedback', () => {
  it('surfaces rejected commands as error toasts', () => {
    const feedback = selectCommandFeedback(makeSnapshot({
      feedback: {
        recentEvents: [
          { type: 'command_rejected', tick: 10, summary: 'Invalid speed' },
        ],
      },
    }));

    expect(feedback.toasts).toHaveLength(1);
    expect(feedback.toasts[0].tone).toBe('error');
    expect(feedback.toasts[0].summary).toBe('Invalid speed');
  });

  it('limits toasts to 3', () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      type: 'command_rejected',
      tick: i,
      summary: `Error ${i}`,
    }));

    const feedback = selectCommandFeedback(makeSnapshot({ feedback: { recentEvents: events } }));
    expect(feedback.toasts).toHaveLength(3);
  });

  it('returns all events as notifications', () => {
    const feedback = selectCommandFeedback(makeSnapshot({
      feedback: {
        recentEvents: [
          { type: 'speed_changed', tick: 5, summary: 'speed=2' },
          { type: 'command_rejected', tick: 10, summary: 'Invalid' },
        ],
      },
    }));

    expect(feedback.notifications).toHaveLength(2);
    expect(feedback.notifications[0].title).toBe('Speed Changed');
  });

  it('returns empty when no events', () => {
    const feedback = selectCommandFeedback(makeSnapshot());
    expect(feedback.toasts).toHaveLength(0);
    expect(feedback.notifications).toHaveLength(0);
  });
});

describe('selectDebugInfo', () => {
  it('returns debug info string', () => {
    expect(selectDebugInfo(makeSnapshot({ debugInfo: 'test debug' }))).toBe('test debug');
  });
});

describe('selectShowDebugPanel', () => {
  it('returns debug panel visibility', () => {
    expect(selectShowDebugPanel(makeSnapshot())).toBe(false);
    expect(selectShowDebugPanel(makeSnapshot({
      presentation: { ...makeSnapshot().presentation, showDebugPanel: true },
    }))).toBe(true);
  });
});
