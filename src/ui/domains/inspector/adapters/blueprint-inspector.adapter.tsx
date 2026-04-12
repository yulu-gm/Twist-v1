/**
 * @file blueprint-inspector.adapter.ts
 * @description Blueprint 对象的 Inspector adapter — 显示材料需求进度与取消操作
 * @dependencies ui/components — StatRow, Section
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectNode, BlueprintObjectNode } from '../../../kernel/ui-types';
import type { ObjectInspectorAdapter, AdapterContext, SpecializedInspectorViewModel, InspectorBodyCallbacks } from '../inspector.types';
import { StatRow } from '../../../components/stat-row';
import { Section } from '../../../components/section';

/** Blueprint Inspector adapter — 蓝图专属 Inspector */
export const blueprintInspectorAdapter: ObjectInspectorAdapter = {
  id: 'blueprint',

  supports(object: ObjectNode): boolean {
    return object.kind === 'blueprint';
  },

  buildViewModel(object: ObjectNode, context: AdapterContext): SpecializedInspectorViewModel {
    const bp = object as BlueprintObjectNode;

    /** 材料行数据 */
    const materialRows = bp.materialsRequired.map((req, i) => ({
      label: req.defId,
      value: `${bp.materialsDelivered[i]?.count ?? 0}/${req.count}`,
    }));

    return {
      mode: 'specialized',
      targetId: context.targetId,
      title: bp.label,
      subtitle: 'Blueprint',
      stack: context.stack,
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          rows: [
            { label: 'Target', value: bp.targetDefId },
            { label: 'Position', value: `(${bp.cell.x}, ${bp.cell.y})` },
            { label: 'Size', value: `${bp.footprint.width}x${bp.footprint.height}` },
          ],
        },
        {
          id: 'materials',
          title: 'Materials',
          rows: materialRows,
        },
      ],
      actions: [
        { id: 'cancel_construction', label: 'Cancel Construction', enabled: true },
      ],
      renderBody: (callbacks: InspectorBodyCallbacks) => (
        <>
          <Section title="Overview">
            <StatRow label="Target" value={bp.targetDefId} />
            <StatRow label="Position" value={`(${bp.cell.x}, ${bp.cell.y})`} />
            <StatRow label="Size" value={`${bp.footprint.width}x${bp.footprint.height}`} />
          </Section>

          <Section title="Materials">
            <div data-testid="section-materials">
              {materialRows.map(row => (
                <StatRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
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
