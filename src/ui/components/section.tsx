/**
 * @file section.tsx
 * @description 分段组件 — 面板内部的逻辑分区，可带小标题
 * @dependencies preact — ComponentChildren 类型
 * @part-of ui/components — 共享 UI 组件库
 */

import type { ComponentChildren } from 'preact';

/** Section 组件属性 */
interface SectionProps {
  /** 段落标题（可选） */
  title?: string;
  /** 子元素 */
  children: ComponentChildren;
}

/** 面板内分段容器 — 用于在检查器等面板中分隔逻辑区域 */
export function Section({ title, children }: SectionProps) {
  return (
    <div class="ui-section">
      {title && <div class="ui-section__title">{title}</div>}
      {children}
    </div>
  );
}
