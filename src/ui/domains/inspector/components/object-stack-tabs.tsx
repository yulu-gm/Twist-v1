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
 * 同格对象栈导航 — 多个对象时显示切换标签
 *
 * 只有栈中超过一个对象时才渲染
 */
export function ObjectStackTabs({ stack, onSelectTarget }: ObjectStackTabsProps) {
  if (stack.length <= 1) return null;

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
