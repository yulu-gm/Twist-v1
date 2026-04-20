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
      actions.push({ id: 'designate_harvest', label: '收获', enabled: true });
    }
    actions.push({ id: 'designate_cut', label: '砍伐', enabled: true });

    return {
      mode: 'specialized',
      targetId: context.targetId,
      title: plant.label,
      subtitle: '植物',
      stack: context.stack,
      sections: [
        {
          id: 'overview',
          title: '概览',
          rows: [
            { label: '类型', value: plant.label },
            { label: '生长', value: `${growthPercent}%` },
            { label: '可收获', value: plant.harvestReady ? '是' : '否' },
            { label: '坐标', value: `(${plant.cell.x}, ${plant.cell.y})` },
          ],
        },
      ],
      actions,
      renderBody: (callbacks: InspectorBodyCallbacks) => (
        <>
          <Section title="概览">
            <StatRow label="类型" value={plant.label} />
            <StatRow label="生长" value={`${growthPercent}%`} />
            <StatRow label="可收获" value={plant.harvestReady ? '是' : '否'} />
            <StatRow label="坐标" value={`(${plant.cell.x}, ${plant.cell.y})`} />
          </Section>

          <div class="inspector-actions" data-testid="inspector-actions">
            {plant.harvestReady && (
              <button
                onClick={() => callbacks.onRunAction('designate_harvest', context.targetId)}
                data-testid="action-designate_harvest"
              >
                收获
              </button>
            )}
            <button
              onClick={() => callbacks.onRunAction('designate_cut', context.targetId)}
              data-testid="action-designate_cut"
            >
              砍伐
            </button>
          </div>
        </>
      ),
    };
  },
};
