/**
 * @file notification-center.tsx
 * @description 通知中心组件 — 展示所有近期游戏事件的可折叠列表
 * @dependencies ui/components — Panel；feedback.types — NotificationItem
 * @part-of ui/domains/feedback — 反馈 UI 领域
 */

import type { NotificationItem } from '../feedback.types';

/** NotificationCenter 组件属性 */
interface NotificationCenterProps {
  /** 是否展开（false 时不渲染） */
  open: boolean;
  /** 通知条目列表 */
  notifications: NotificationItem[];
}

/**
 * 通知中心 — 可折叠的游戏事件列表
 *
 * 关闭时不渲染任何 DOM。
 * 打开但无通知时显示 "No events" 空状态提示。
 * 每条通知显示 tick 标记、标题和摘要。
 */
export function NotificationCenter({ open, notifications }: NotificationCenterProps) {
  if (!open) return null;

  return (
    <div class="notification-center ui-panel">
      <div class="ui-panel__title">Notifications</div>
      <div class="ui-panel__body">
        {notifications.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>No events</p>
        )}
        {notifications.map(item => (
          <div key={item.id} class="notification-center__item">
            <span class="notification-center__tick">T:{item.tick}</span>
            <div class="notification-center__title">{item.title}</div>
            <div class="notification-center__summary">{item.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
