/**
 * @file colonist-inspector.tsx
 * @description 殖民者检查器组件 — 选中殖民者后显示的详情面板
 * @dependencies ui/components — ProgressBar, StatRow, Section；
 *               colonist.types — ColonistInspectorViewModel
 * @part-of ui/domains/colonist — 殖民者 UI 领域
 */

import { ProgressBar } from '../../../components/progress-bar';
import { StatRow } from '../../../components/stat-row';
import { Section } from '../../../components/section';
import type { ColonistInspectorViewModel } from '../colonist.types';

/** ColonistInspector 组件属性 */
interface ColonistInspectorProps {
  /** 检查器视图模型（由 selectColonistInspector 选择器生成） */
  viewModel: ColonistInspectorViewModel;
}

/**
 * 殖民者详情检查器 — 显示选中殖民者的属性和需求
 *
 * 分为两个区段：
 * - Info：位置、任务、阵营、生命值
 * - Needs：食物、休息、娱乐、心情的进度条
 */
export function ColonistInspector({ viewModel }: ColonistInspectorProps) {
  return (
    <div class="inspector-panel">
      <div class="inspector-panel__header">{viewModel.name}</div>
      <div class="inspector-panel__body">
        <Section title="Info">
          <StatRow label="Position" value={`(${viewModel.cell.x}, ${viewModel.cell.y})`} />
          <StatRow label="Job" value={viewModel.jobLabel} />
          <StatRow label="Faction" value={viewModel.factionId || '-'} />
          <StatRow label="HP" value={`${viewModel.health.hp}/${viewModel.health.maxHp}`} />
        </Section>

        <Section title="Needs">
          {viewModel.needs.map(need => (
            <ProgressBar
              key={need.key}
              label={need.label}
              value={need.value}
              color={need.color}
            />
          ))}
        </Section>
      </div>
    </div>
  );
}
