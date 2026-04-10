/**
 * @file ui-actions.ts
 * @description UI Action 工厂函数 — 提供类型安全的 action 创建器
 * @dependencies ui-reducer — UiAction 类型；ui-types — UiState 类型
 * @part-of ui/kernel — UI 内核层
 */

import type { UiAction } from './ui-reducer';
import type { UiState } from './ui-types';

/** 切换主面板 */
export const openPanel = (panel: UiState['activePanel']): UiAction => ({
  type: 'open_panel',
  panel,
});

/** 切换检查器标签页 */
export const setInspectorTab = (tab: UiState['inspectorTab']): UiAction => ({
  type: 'set_inspector_tab',
  tab,
});

/** 设置殖民者列表排序方式 */
export const setColonistSort = (sort: UiState['colonistSort']): UiAction => ({
  type: 'set_colonist_sort',
  sort,
});

/** 设置殖民者搜索关键词 */
export const setColonistSearch = (value: string): UiAction => ({
  type: 'set_colonist_search',
  value,
});

/** 切换通知中心展开/折叠 */
export const toggleNotificationCenter = (): UiAction => ({
  type: 'toggle_notification_center',
});

/** 固定/取消固定选中的殖民者 */
export const pinColonist = (colonistId: string | null): UiAction => ({
  type: 'pin_colonist',
  colonistId,
});
