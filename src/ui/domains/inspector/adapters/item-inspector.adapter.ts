/**
 * @file item-inspector.adapter.ts
 * @description Item 对象的 Inspector adapter — 显示物品基本信息与堆叠数量
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectNode } from '../../../kernel/ui-types';
import type { ObjectInspectorAdapter, AdapterContext, SpecializedInspectorViewModel } from '../inspector.types';

/** Item Inspector adapter — 物品专属 Inspector */
export const itemInspectorAdapter: ObjectInspectorAdapter = {
  id: 'item',

  supports(object: ObjectNode): boolean {
    return object.kind === 'item';
  },

  buildViewModel(object: ObjectNode, context: AdapterContext): SpecializedInspectorViewModel {
    const item = object as import('../../../kernel/ui-types').ItemObjectNode;

    return {
      mode: 'specialized',
      targetId: context.targetId,
      title: item.label,
      subtitle: 'Item',
      stack: context.stack,
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          rows: [
            { label: 'Type', value: item.defId },
            { label: 'Stack', value: String(item.stackCount) },
            { label: 'Position', value: `(${item.cell.x}, ${item.cell.y})` },
          ],
        },
      ],
      actions: [],
    };
  },
};
