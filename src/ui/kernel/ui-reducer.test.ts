/**
 * @file ui-reducer.test.ts
 * @description UI Reducer 测试 — 验证初始状态创建和各 action 的状态变更
 * @part-of ui/kernel — UI 内核层
 */

import { describe, expect, it } from 'vitest';
import { createInitialUiState, uiReducer } from './ui-reducer';

describe('uiReducer', () => {
  it('returns initial state', () => {
    const state = createInitialUiState();
    expect(state.activePanel).toBe('colonists');
    expect(state.inspectorTab).toBe('overview');
    expect(state.colonistSort).toBe('name');
  });

  it('updates the active panel', () => {
    const next = uiReducer(createInitialUiState(), {
      type: 'open_panel',
      panel: 'build',
    });
    expect(next.activePanel).toBe('build');
  });

  it('updates inspector tab', () => {
    const next = uiReducer(createInitialUiState(), {
      type: 'set_inspector_tab',
      tab: 'job',
    });
    expect(next.inspectorTab).toBe('job');
  });

  it('toggles notification center', () => {
    const state = createInitialUiState();
    expect(state.notificationCenterOpen).toBe(false);
    const next = uiReducer(state, { type: 'toggle_notification_center' });
    expect(next.notificationCenterOpen).toBe(true);
    const again = uiReducer(next, { type: 'toggle_notification_center' });
    expect(again.notificationCenterOpen).toBe(false);
  });

  it('pins a colonist', () => {
    const next = uiReducer(createInitialUiState(), {
      type: 'pin_colonist',
      colonistId: 'pawn_1',
    });
    expect(next.pinnedColonistId).toBe('pawn_1');
  });

  it('sets colonist sort', () => {
    const next = uiReducer(createInitialUiState(), {
      type: 'set_colonist_sort',
      sort: 'mood',
    });
    expect(next.colonistSort).toBe('mood');
  });
});
