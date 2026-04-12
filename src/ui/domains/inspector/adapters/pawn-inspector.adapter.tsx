/**
 * @file pawn-inspector.adapter.ts
 * @description Pawn（殖民者）对象的 Inspector adapter — 从 PawnObjectNode 构建专属视图模型
 * @dependencies ui/components — ProgressBar, StatRow, Section；
 *               colonist.schemas — needDefs（需求定义与颜色）；
 *               colonist.selectors — buildWorkQueue（工作队列构建）
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectNode, PawnObjectNode } from '../../../kernel/ui-types';
import type { ObjectInspectorAdapter, AdapterContext, SpecializedInspectorViewModel, InspectorSection } from '../inspector.types';
import { ProgressBar } from '../../../components/progress-bar';
import { StatRow } from '../../../components/stat-row';
import { Section } from '../../../components/section';
import { needDefs } from '../../colonist/colonist.schemas';
import { buildWorkQueue } from '../../colonist/colonist.selectors';
import type { ColonistNode } from '../../../kernel/ui-types';

/** Pawn Inspector adapter — 殖民者专属 Inspector */
export const pawnInspectorAdapter: ObjectInspectorAdapter = {
  id: 'pawn',

  supports(object: ObjectNode): boolean {
    return object.kind === 'pawn';
  },

  buildViewModel(object: ObjectNode, context: AdapterContext): SpecializedInspectorViewModel {
    const pawn = object as PawnObjectNode;

    /** sections 数据（供测试和降级使用） */
    const sections: InspectorSection[] = [
      {
        id: 'overview',
        title: 'Overview',
        rows: [
          { label: 'Job', value: pawn.currentJobLabel },
          { label: 'HP', value: `${pawn.health.hp}/${pawn.health.maxHp}` },
          { label: 'Position', value: `(${pawn.cell.x}, ${pawn.cell.y})` },
        ],
      },
      {
        id: 'needs',
        title: 'Needs',
        rows: [
          { label: 'Food', value: String(pawn.needs.food) },
          { label: 'Rest', value: String(pawn.needs.rest) },
          { label: 'Joy', value: String(pawn.needs.joy) },
          { label: 'Mood', value: String(pawn.needs.mood) },
        ],
      },
    ];

    /** 构建工作队列行（复用 colonist.selectors 的逻辑） */
    const workQueue = buildWorkQueue({ workDecision: pawn.workDecision } as ColonistNode);

    return {
      mode: 'specialized',
      targetId: context.targetId,
      title: pawn.label,
      subtitle: 'Pawn',
      stack: context.stack,
      sections,
      actions: [],
      renderBody: () => (
        <>
          <Section title="Info">
            <StatRow label="Position" value={`(${pawn.cell.x}, ${pawn.cell.y})`} />
            <StatRow label="Job" value={pawn.currentJobLabel} />
            <StatRow label="HP" value={`${pawn.health.hp}/${pawn.health.maxHp}`} />
          </Section>

          <Section title="Needs">
            {needDefs.map(def => (
              <ProgressBar
                key={def.key}
                label={def.label}
                value={pawn.needs[def.key as keyof typeof pawn.needs]}
                color={def.color}
              />
            ))}
          </Section>

          <Section title="工作队列">
            {workQueue.length === 0 ? (
              <div class="colonist-work-queue__empty">暂无决策快照</div>
            ) : (
              <ul class="colonist-work-queue">
                {workQueue.map((row) => (
                  <li key={`${row.label}-${row.tone}`} class={`colonist-work-queue__row is-${row.tone}`}>
                    <div class="colonist-work-queue__label">{row.label}</div>
                    {row.detail && <div class="colonist-work-queue__detail">{row.detail}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      ),
    };
  },
};
