/**
 * @file ui-store.ts
 * @description UI 状态辅助工具 — 提供批量 action 应用等便利函数
 * @dependencies ui-reducer — createInitialUiState, uiReducer；ui-types — UiState
 * @part-of ui/kernel — UI 内核层
 */

import { createInitialUiState, uiReducer, type UiAction } from './ui-reducer';
import type { UiState } from './ui-types';

/**
 * 批量应用多个 action 到 UI 状态 — 主要用于测试
 *
 * @param actions - 要依次应用的 action 列表
 * @param state - 初始状态，默认为 createInitialUiState()
 * @returns 应用所有 action 后的最终状态
 */
export function reduceActions(actions: UiAction[], state: UiState = createInitialUiState()): UiState {
  return actions.reduce(uiReducer, state);
}
