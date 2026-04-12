/**
 * @file object-inspector.tsx
 * @description 统一 Object Inspector 容器组件 — 根据视图模型渲染通用或专属 Inspector
 * @dependencies inspector.types — 视图模型类型
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectInspectorViewModel } from '../inspector.types';
import { ObjectStackTabs } from './object-stack-tabs';

interface ObjectInspectorProps {
  /** Inspector 视图模型 */
  viewModel: ObjectInspectorViewModel;
  /** 切换同格对象 target 的回调 */
  onSelectTarget: (targetId: string) => void;
  /** 执行操作按钮的回调 */
  onRunAction: (actionId: string, targetId: string) => void;
}

/**
 * 统一 Object Inspector — 根据视图模式渲染通用或专属内容
 *
 * 结构：
 * 1. 同格对象栈导航（仅多对象时显示）
 * 2. 通用头部（标题 + 类型标签）
 * 3. 内容区：generic 显示降级提示 + 基础属性；specialized 显示区块 + 操作
 */
export function ObjectInspector({ viewModel, onSelectTarget, onRunAction }: ObjectInspectorProps) {
  const vm = viewModel;

  return (
    <div class="object-inspector" data-testid="object-inspector">
      {/* 同格对象栈导航 */}
      <ObjectStackTabs stack={vm.stack} onSelectTarget={onSelectTarget} />

      {/* 通用头部 */}
      <div class="inspector-header">
        <h3 data-testid="inspector-title">{vm.title}</h3>
        <span class="inspector-subtitle" data-testid="inspector-subtitle">{vm.subtitle}</span>
      </div>

      {/* 内容区 */}
      {vm.mode === 'generic' ? (
        <div class="inspector-generic">
          {/* 降级提示 */}
          <div class="inspector-fallback-notice" data-testid="fallback-notice">
            {vm.fallbackNotice}
          </div>
          {/* 基础属性 */}
          <div class="inspector-stats">
            {vm.stats.map(stat => (
              <div class="stat-row" key={stat.label}>
                <span class="stat-label">{stat.label}</span>
                <span class="stat-value">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div class="inspector-specialized">
          {/* 专属区块 */}
          {vm.sections.map(section => (
            <div class="inspector-section" key={section.id} data-testid={`section-${section.id}`}>
              <h4>{section.title}</h4>
              {section.rows.map(row => (
                <div class="stat-row" key={row.label}>
                  <span class="stat-label">{row.label}</span>
                  <span class="stat-value">{row.value}</span>
                </div>
              ))}
            </div>
          ))}
          {/* 操作按钮 */}
          {vm.actions.length > 0 && (
            <div class="inspector-actions" data-testid="inspector-actions">
              {vm.actions.map(action => (
                <button
                  key={action.id}
                  disabled={!action.enabled}
                  onClick={() => onRunAction(action.id, vm.targetId)}
                  data-testid={`action-${action.id}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
