/**
 * @file feedback.selectors.ts
 * @description 反馈领域的选择器 — 从 EngineSnapshot 派生 Toast、通知、调试面板数据
 * @dependencies ui/kernel/ui-types — EngineSnapshot；feedback.types — FeedbackViewModel,
 *               ToastItem, NotificationItem；feedback.schemas — getEventSeverity, formatEventTitle
 * @part-of ui/domains/feedback — 反馈 UI 领域
 */

import type { EngineSnapshot } from '../../kernel/ui-types';
import type { FeedbackViewModel, ToastItem, NotificationItem } from './feedback.types';
import { formatEventTitle } from './feedback.schemas';

/**
 * 选择命令反馈视图模型 — 从近期事件中提取 Toast 和通知列表
 *
 * @param snapshot - 引擎快照
 * @returns 反馈视图模型，包含：
 *   - toasts: 最近 3 条被拒绝的命令（显示为红色 Toast）
 *   - notifications: 所有近期事件（显示在通知中心）
 */
export function selectCommandFeedback(snapshot: EngineSnapshot): FeedbackViewModel {
  // 从被拒绝的命令中提取 Toast（最多 3 条）
  const toasts: ToastItem[] = snapshot.feedback.recentEvents
    .filter(event => event.type === 'command_rejected')
    .slice(0, 3)
    .map(event => ({
      id: `${event.type}-${event.tick}`,
      tone: 'error' as const,
      title: 'Command rejected',
      summary: event.summary,
    }));

  // 所有近期事件转为通知条目
  const notifications: NotificationItem[] = snapshot.feedback.recentEvents.map(event => ({
    id: `${event.type}-${event.tick}`,
    title: formatEventTitle(event.type),
    summary: event.summary,
    tick: event.tick,
  }));

  return { toasts, notifications };
}

/**
 * 选择调试信息文本
 *
 * @param snapshot - 引擎快照
 * @returns 预格式化的调试字符串
 */
export function selectDebugInfo(snapshot: EngineSnapshot): string {
  return snapshot.debugInfo;
}

/**
 * 选择调试面板可见性
 *
 * @param snapshot - 引擎快照
 * @returns 调试面板是否应显示
 */
export function selectShowDebugPanel(snapshot: EngineSnapshot): boolean {
  return snapshot.presentation.showDebugPanel;
}
