/**
 * @file toast-stack.tsx
 * @description Toast 提示栈组件 — 在屏幕角落显示短暂的错误/信息提示
 * @dependencies feedback.types — ToastItem
 * @part-of ui/domains/feedback — 反馈 UI 领域
 */

import type { ToastItem } from '../feedback.types';

/** ToastStack 组件属性 */
interface ToastStackProps {
  /** 要显示的 Toast 列表 */
  toasts: ToastItem[];
}

/**
 * Toast 提示栈 — 垂直堆叠显示近期提示
 *
 * 无 Toast 时不渲染任何 DOM。
 * 每条 Toast 根据 tone 字段应用对应的语义样式。
 */
export function ToastStack({ toasts }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div class="toast-stack">
      {toasts.map(toast => (
        <div key={toast.id} class={`toast toast--${toast.tone}`}>
          {toast.summary}
        </div>
      ))}
    </div>
  );
}
