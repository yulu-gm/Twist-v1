/**
 * @file item-inspector.adapter.ts
 * @description Item 对象的 Inspector adapter — 显示物品基本信息与堆叠数量
 * @dependencies ui/components — StatRow, Section
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectNode, ItemObjectNode } from '../../../kernel/ui-types';
import type { ObjectInspectorAdapter, AdapterContext, SpecializedInspectorViewModel } from '../inspector.types';
import { StatRow } from '../../../components/stat-row';
import { Section } from '../../../components/section';

/** Item Inspector adapter — 物品专属 Inspector */
export const itemInspectorAdapter: ObjectInspectorAdapter = {
  id: 'item',

  supports(object: ObjectNode): boolean {
    return object.kind === 'item';
  },

  buildViewModel(object: ObjectNode, context: AdapterContext): SpecializedInspectorViewModel {
    const item = object as ItemObjectNode;

    return {
      mode: 'specialized',
      targetId: context.targetId,
      title: item.label,
      subtitle: '物品',
      stack: context.stack,
      sections: [
        {
          id: 'overview',
          title: '概览',
          rows: [
            { label: '类型', value: item.label },
            { label: '堆叠', value: String(item.stackCount) },
            { label: '坐标', value: `(${item.cell.x}, ${item.cell.y})` },
          ],
        },
      ],
      actions: [],
      renderBody: () => (
        <Section title="概览">
          <StatRow label="类型" value={item.label} />
          <StatRow label="堆叠" value={String(item.stackCount)} />
          <StatRow label="坐标" value={`(${item.cell.x}, ${item.cell.y})`} />
        </Section>
      ),
    };
  },
};
