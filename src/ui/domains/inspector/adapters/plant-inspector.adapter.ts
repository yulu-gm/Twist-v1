/**
 * @file plant-inspector.adapter.ts
 * @description Plant 对象的 Inspector adapter — 显示植物生长与收获状态
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectNode } from '../../../kernel/ui-types';
import type { ObjectInspectorAdapter, AdapterContext, SpecializedInspectorViewModel, InspectorAction } from '../inspector.types';

/** Plant Inspector adapter — 植物专属 Inspector */
export const plantInspectorAdapter: ObjectInspectorAdapter = {
  id: 'plant',

  supports(object: ObjectNode): boolean {
    return object.kind === 'plant';
  },

  buildViewModel(object: ObjectNode, context: AdapterContext): SpecializedInspectorViewModel {
    const plant = object as import('../../../kernel/ui-types').PlantObjectNode;
    const growthPercent = Math.round(plant.growth * 100);

    const actions: InspectorAction[] = [];
    if (plant.harvestReady) {
      actions.push({ id: 'designate_harvest', label: 'Harvest', enabled: true });
    }
    actions.push({ id: 'designate_cut', label: 'Cut', enabled: true });

    return {
      mode: 'specialized',
      targetId: context.targetId,
      title: plant.label,
      subtitle: 'Plant',
      stack: context.stack,
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          rows: [
            { label: 'Type', value: plant.defId },
            { label: 'Growth', value: `${growthPercent}%` },
            { label: 'Harvestable', value: plant.harvestReady ? 'Yes' : 'No' },
            { label: 'Position', value: `(${plant.cell.x}, ${plant.cell.y})` },
          ],
        },
      ],
      actions,
    };
  },
};
