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

    /** 材料行数据 — label 已由 snapshot-reader 用 defs 解析为中文 */
    const materialRows = bp.materialsRequired.map((req, i) => ({
      label: req.label,
      value: `${bp.materialsDelivered[i]?.count ?? 0}/${req.count}`,
    }));

    return {
      mode: 'specialized',
      targetId: context.targetId,
      title: bp.label,
      subtitle: '蓝图',
      stack: context.stack,
      sections: [
        {
          id: 'overview',
          title: '概览',
          rows: [
            { label: '目标', value: bp.targetLabel },
            { label: '坐标', value: `(${bp.cell.x}, ${bp.cell.y})` },
            { label: '尺寸', value: `${bp.footprint.width}x${bp.footprint.height}` },
          ],
        },
        {
          id: 'materials',
          title: '材料',
          rows: materialRows,
        },
      ],
      actions: [
        { id: 'cancel_construction', label: '取消建造', enabled: true },
      ],
      renderBody: (callbacks: InspectorBodyCallbacks) => (
        <>
          <Section title="概览">
            <StatRow label="目标" value={bp.targetLabel} />
            <StatRow label="坐标" value={`(${bp.cell.x}, ${bp.cell.y})`} />
            <StatRow label="尺寸" value={`${bp.footprint.width}x${bp.footprint.height}`} />
          </Section>

          <Section title="材料">
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
              取消建造
            </button>
          </div>
        </>
      ),
    };
  },
};
