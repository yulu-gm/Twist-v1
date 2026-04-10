/**
 * @file panel.tsx
 * @description 通用面板组件 — 带标题和可见性控制的容器
 * @dependencies preact — ComponentChildren 类型
 * @part-of ui/components — 共享 UI 组件库
 */

import type { ComponentChildren } from 'preact';

/** Panel 组件属性 */
interface PanelProps {
  /** 面板标题（可选，不传则不显示标题栏） */
  title?: string;
  /** 额外的 CSS 类名 */
  class?: string;
  /** 是否可见，默认 true */
  visible?: boolean;
  /** 子元素 */
  children: ComponentChildren;
}

/**
 * 通用面板容器 — 提供标题栏和内容区的标准布局
 *
 * visible 为 false 时不渲染任何 DOM
 */
export function Panel({ title, class: cls, visible = true, children }: PanelProps) {
  if (!visible) return null;
  return (
    <div class={`ui-panel ${cls ?? ''}`}>
      {title && <div class="ui-panel__title">{title}</div>}
      <div class="ui-panel__body">{children}</div>
    </div>
  );
}
