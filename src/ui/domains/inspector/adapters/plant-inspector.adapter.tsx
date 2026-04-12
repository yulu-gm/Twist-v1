/**
 * @file plant-inspector.adapter.ts
 * @description Plant 对象的 Inspector adapter — 显示植物生长与收获状态
 * @dependencies ui/components — StatRow, Section
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectNode, PlantObjectNode } from '../../../kernel/ui-types';
import type { ObjectInspectorAdapter, AdapterContext, SpecializedInspectorViewModel, InspectorAction, InspectorBodyCallbacks } from '../inspector.types';
import { StatRow } from '../../../components/stat-row';
import { Section } from '../../../components/section';

/** Plant Inspector adapter — 植物专属 Inspector */
export const plantInspectorAdapter: ObjectInspectorAdapter = {
  id: 'plant',

  supports(object: ObjectNode): boolean {
    return object.kind === 'plant';
  },

  buildViewModel(object: ObjectNode, context: AdapterContext): SpecializedInspectorViewModel {
    const plant = object as PlantObjectNode;
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
      renderBody: (callbacks: InspectorBodyCallbacks) => (
        <>
          <Section title="Overview">
            <StatRow label="Type" value={plant.defId} />
            <StatRow label="Growth" value={`${growthPercent}%`} />
            <StatRow label="Harvestable" value={plant.harvestReady ? 'Yes' : 'No'} />
            <StatRow label="Position" value={`(${plant.cell.x}, ${plant.cell.y})`} />
          </Section>

          <div class="inspector-actions" data-testid="inspector-actions">
            {plant.harvestReady && (
              <button
                onClick={() => callbacks.onRunAction('designate_harvest', context.targetId)}
                data-testid="action-designate_harvest"
              >
                Harvest
              </button>
            )}
            <button
              onClick={() => callbacks.onRunAction('designate_cut', context.targetId)}
              data-testid="action-designate_cut"
            >
              Cut
            </button>
          </div>
        </>
      ),
    };
  },
};
