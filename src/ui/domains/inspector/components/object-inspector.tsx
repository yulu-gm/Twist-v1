/**
 * @file object-inspector.tsx
 * @description 统一 Object Inspector 容器组件 — 根据视图模型渲染通用或专属 Inspector
 * @dependencies inspector.types — 视图模型类型；
 *               ui/components — Section, StatRow 共享组件
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectInspectorViewModel, InspectorBodyCallbacks } from '../inspector.types';
import { ObjectStackTabs } from './object-stack-tabs';
import { Section } from '../../../components/section';
import { StatRow } from '../../../components/stat-row';

interface ObjectInspectorProps {
  /** Inspector 视图模型 */
  viewModel: ObjectInspectorViewModel;
  /** 切换同格对象 target 的回调 */
  onSelectTarget: (targetId: string) => void;
  /** 执行操作按钮的回调 */
  onRunAction: (actionId: string, targetId: string) => void;
  /** 指派床位所有者的回调 */
  onAssignBedOwner?: (bedId: string, pawnId: string) => void;
  /** 清除床位所有者的回调 */
  onClearBedOwner?: (bedId: string) => void;
}

/**
 * 统一 Object Inspector — 根据视图模式渲染通用或专属内容
 *
 * 结构：
 * 1. 同格对象栈导航（仅多对象时显示）
 * 2. 通用头部（标题 + 类型标签）
 * 3. 内容区：generic 显示降级提示 + 基础属性；specialized 显示自定义渲染体或区块 + 操作
 *
 * 使用 .inspector-panel 样式体系，与原 colonist-inspector / building-inspector 一致
 */
export function ObjectInspector({ viewModel, onSelectTarget, onRunAction, onAssignBedOwner, onClearBedOwner }: ObjectInspectorProps) {
  const vm = viewModel;

  /** 构建传给 renderBody 的回调集合 */
  const bodyCallbacks: InspectorBodyCallbacks = {
    onRunAction,
    onAssignBedOwner: onAssignBedOwner ?? (() => {}),
    onClearBedOwner: onClearBedOwner ?? (() => {}),
  };

  return (
    <div class="inspector-panel" data-testid="object-inspector">
      {/* 同格对象栈导航 */}
      <ObjectStackTabs stack={vm.stack} onSelectTarget={onSelectTarget} />

      {/* 通用头部 */}
      <div class="inspector-panel__header" data-testid="inspector-title">
        {vm.title}
      </div>

      {/* 内容区 */}
      <div class="inspector-panel__body">
        {vm.mode === 'generic' ? (
          <>
            {/* 降级提示 */}
            <div class="inspector-fallback-notice" data-testid="fallback-notice">
              {vm.fallbackNotice}
            </div>
            {/* 基础属性 */}
            <Section title="Info">
              {vm.stats.map(stat => (
                <StatRow key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </Section>
          </>
        ) : vm.renderBody ? (
          /* 专属自定义渲染体 — adapter 提供的富内容 */
          vm.renderBody(bodyCallbacks)
        ) : (
          /* 专属区块降级渲染 — 无 renderBody 时使用 sections 数据 */
          <>
            {vm.sections.map(section => (
              <Section key={section.id} title={section.title}>
                <div data-testid={`section-${section.id}`}>
                  {section.rows.map(row => (
                    <StatRow key={row.label} label={row.label} value={row.value} />
                  ))}
                </div>
              </Section>
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
          </>
        )}
      </div>
    </div>
  );
}
