/**
 * @file tabs.tsx
 * @description 标签页组件 — 水平排列的可切换标签按钮组
 * @dependencies 无外部依赖
 * @part-of ui/components — 共享 UI 组件库
 */

/** Tabs 组件属性 */
interface TabsProps {
  /** 所有标签页名称 */
  tabs: readonly string[];
  /** 当前激活的标签页 */
  activeTab: string;
  /** 标签页切换回调 */
  onSelect: (tab: string) => void;
}

/** 标签页切换器 — 用于检查器面板等多视图切换场景 */
export function Tabs({ tabs, activeTab, onSelect }: TabsProps) {
  return (
    <div class="tabs">
      {tabs.map(tab => (
        <button
          key={tab}
          class={`tabs__btn ${activeTab === tab ? 'is-active' : ''}`}
          onClick={() => onSelect(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
