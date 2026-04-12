/**
 * @file ui-reducer.ts
 * @description UI 本地状态的 Reducer — 管理面板切换、排序、搜索等纯 UI 状态
 * @dependencies ui-types — UiState 类型定义
 * @part-of ui/kernel — UI 内核层
 */

import type { UiState } from './ui-types';

// ── Action 类型定义 ──

/** UI 动作联合类型 — 所有可 dispatch 的 UI 状态变更 */
export type UiAction =
  | { type: 'open_panel'; panel: UiState['activePanel'] }
  | { type: 'set_inspector_tab'; tab: UiState['inspectorTab'] }
  | { type: 'set_colonist_sort'; sort: UiState['colonistSort'] }
  | { type: 'set_colonist_search'; value: string }
  | { type: 'set_build_search'; value: string }
  | { type: 'toggle_notification_center' }
  | { type: 'pin_colonist'; colonistId: string | null }
  | { type: 'set_inspector_target'; targetId: string | null };

/**
 * 创建 UI 初始状态
 *
 * @returns 默认的 UiState，所有面板关闭、排序为按名称、无搜索
 */
export function createInitialUiState(): UiState {
  return {
    activePanel: 'colonists',
    inspectorTab: 'overview',
    colonistSort: 'name',
    colonistSearch: '',
    buildSearch: '',
    notificationCenterOpen: false,
    pinnedColonistId: null,
    inspectorTargetId: null,
  };
}

/**
 * UI 状态 Reducer — 纯函数，根据 action 返回新的 UiState
 *
 * @param state - 当前 UI 状态
 * @param action - 要执行的动作
 * @returns 新的 UI 状态（不可变更新）
 */
export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'open_panel':
      return { ...state, activePanel: action.panel };
    case 'set_inspector_tab':
      return { ...state, inspectorTab: action.tab };
    case 'set_colonist_sort':
      return { ...state, colonistSort: action.sort };
    case 'set_colonist_search':
      return { ...state, colonistSearch: action.value };
    case 'set_build_search':
      return { ...state, buildSearch: action.value };
    case 'toggle_notification_center':
      return { ...state, notificationCenterOpen: !state.notificationCenterOpen };
    case 'pin_colonist':
      return { ...state, pinnedColonistId: action.colonistId };
    case 'set_inspector_target':
      return { ...state, inspectorTargetId: action.targetId };
  }
}
