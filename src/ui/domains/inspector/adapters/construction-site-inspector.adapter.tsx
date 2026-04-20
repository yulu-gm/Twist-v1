/**
 * @file construction-site-inspector.adapter.ts
 * @description ConstructionSite 对象的 Inspector adapter — 显示建造进度与取消操作
 * @dependencies ui/components — StatRow, Section
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectNode, ConstructionSiteObjectNode } from '../../../kernel/ui-types';
import type { ObjectInspectorAdapter, AdapterContext, SpecializedInspectorViewModel, InspectorBodyCallbacks } from '../inspector.types';
import { StatRow } from '../../../components/stat-row';
import { Section } from '../../../components/section';

/** ConstructionSite Inspector adapter — 施工工地专属 Inspector */
export const constructionSiteInspectorAdapter: ObjectInspectorAdapter = {
  id: 'construction_site',

  supports(object: ObjectNode): boolean {
    return object.kind === 'construction_site';
  },

  buildViewModel(object: ObjectNode, context: AdapterContext): SpecializedInspectorViewModel {
    const site = object as ConstructionSiteObjectNode;
    const progressPercent = Math.round(site.buildProgress * 100);

    return {
      mode: 'specialized',
      targetId: context.targetId,
      title: site.label,
      subtitle: '施工工地',
      stack: context.stack,
      sections: [
        {
          id: 'overview',
          title: '概览',
          rows: [
            { label: '目标', value: site.targetLabel },
            { label: '进度', value: `${progressPercent}%` },
            { label: '坐标', value: `(${site.cell.x}, ${site.cell.y})` },
            { label: '尺寸', value: `${site.footprint.width}x${site.footprint.height}` },
          ],
        },
      ],
      actions: [
        { id: 'cancel_construction', label: '取消建造', enabled: true },
      ],
      renderBody: (callbacks: InspectorBodyCallbacks) => (
        <>
          <Section title="概览">
            <StatRow label="目标" value={site.targetLabel} />
            <StatRow label="进度" value={`${progressPercent}%`} />
            <StatRow label="坐标" value={`(${site.cell.x}, ${site.cell.y})`} />
            <StatRow label="尺寸" value={`${site.footprint.width}x${site.footprint.height}`} />
          </Section>

          <div class="inspector-actions" data-testid="inspector-actions">
            <button
              onClick={() => callbacks.onRunAction('cancel_construction', context.targetId)}
              data-testid="action-cancel_construction"
            >
              取消建造
            </button>
          </div>
        </>
      ),
    };
  },
};
