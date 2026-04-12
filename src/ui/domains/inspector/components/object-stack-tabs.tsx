/**
 * @file object-stack-tabs.tsx
 * @description 同格对象栈导航组件 — 展示同格上的多个对象，允许切换 Inspector target
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectStackEntryViewModel } from '../inspector.types';

interface ObjectStackTabsProps {
  /** 同格对象栈 */
  stack: ObjectStackEntryViewModel[];
  /** 切换 Inspector target 的回调 */
  onSelectTarget: (targetId: string) => void;
}

/**
 * 同格对象栈导航 — 常驻显示切换标签栏
 *
 * 始终渲染标签栏，避免同格对象数量在 1 与多个之间快速变化时产生闪烁
 */
export function ObjectStackTabs({ stack, onSelectTarget }: ObjectStackTabsProps) {
  return (
    <div class="object-stack-tabs" data-testid="object-stack-tabs">
      {stack.map(entry => (
        <button
          key={entry.id}
          class={`stack-tab ${entry.isActive ? 'active' : ''}`}
          onClick={() => onSelectTarget(entry.id)}
          data-testid={`stack-tab-${entry.id}`}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
