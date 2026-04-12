/**
 * @file blueprint-inspector.adapter.ts
 * @description Blueprint 对象的 Inspector adapter — 显示材料需求进度与取消操作
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectNode } from '../../../kernel/ui-types';
import type { ObjectInspectorAdapter, AdapterContext, SpecializedInspectorViewModel } from '../inspector.types';

/** Blueprint Inspector adapter — 蓝图专属 Inspector */
export const blueprintInspectorAdapter: ObjectInspectorAdapter = {
  id: 'blueprint',

  supports(object: ObjectNode): boolean {
    return object.kind === 'blueprint';
  },

  buildViewModel(object: ObjectNode, context: AdapterContext): SpecializedInspectorViewModel {
    const bp = object as import('../../../kernel/ui-types').BlueprintObjectNode;

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
          rows: bp.materialsRequired.map((req, i) => ({
            label: req.defId,
            value: `${bp.materialsDelivered[i]?.count ?? 0}/${req.count}`,
          })),
        },
      ],
      actions: [
        { id: 'cancel_construction', label: 'Cancel Construction', enabled: true },
      ],
    };
  },
};
