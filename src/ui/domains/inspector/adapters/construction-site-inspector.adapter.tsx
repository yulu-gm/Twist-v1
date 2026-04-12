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
      subtitle: 'Construction Site',
      stack: context.stack,
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          rows: [
            { label: 'Target', value: site.targetDefId },
            { label: 'Progress', value: `${progressPercent}%` },
            { label: 'Position', value: `(${site.cell.x}, ${site.cell.y})` },
            { label: 'Size', value: `${site.footprint.width}x${site.footprint.height}` },
          ],
        },
      ],
      actions: [
        { id: 'cancel_construction', label: 'Cancel Construction', enabled: true },
      ],
      renderBody: (callbacks: InspectorBodyCallbacks) => (
        <>
          <Section title="Overview">
            <StatRow label="Target" value={site.targetDefId} />
            <StatRow label="Progress" value={`${progressPercent}%`} />
            <StatRow label="Position" value={`(${site.cell.x}, ${site.cell.y})`} />
            <StatRow label="Size" value={`${site.footprint.width}x${site.footprint.height}`} />
          </Section>

          <div class="inspector-actions" data-testid="inspector-actions">
            <button
              onClick={() => callbacks.onRunAction('cancel_construction', context.targetId)}
              data-testid="action-cancel_construction"
            >
              Cancel Construction
            </button>
          </div>
        </>
      ),
    };
  },
};
