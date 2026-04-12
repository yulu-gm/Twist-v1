/**
 * @file building-inspector.adapter.ts
 * @description Building 对象的 Inspector adapter — 从 BuildingObjectNode 构建专属视图模型
 * @dependencies ui/components — StatRow, Section；
 *               inspector.types — InspectorBodyCallbacks
 * @part-of ui/domains/inspector — Inspector UI 领域
 */

import type { ObjectNode, BuildingObjectNode } from '../../../kernel/ui-types';
import type { ObjectInspectorAdapter, AdapterContext, SpecializedInspectorViewModel, InspectorSection, InspectorAction, InspectorBodyCallbacks } from '../inspector.types';
import { StatRow } from '../../../components/stat-row';
import { Section } from '../../../components/section';

/** 将下划线分隔的标识符转换为首字母大写的可读文本 */
function toTitleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

/** Building Inspector adapter — 建筑专属 Inspector */
export const buildingInspectorAdapter: ObjectInspectorAdapter = {
  id: 'building',

  supports(object: ObjectNode): boolean {
    return object.kind === 'building';
  },

  buildViewModel(object: ObjectNode, context: AdapterContext): SpecializedInspectorViewModel {
    const building = object as BuildingObjectNode;

    const sections: InspectorSection[] = [];
    const actions: InspectorAction[] = [];

    // 通用信息区块
    const infoRows = [
      { label: 'Type', value: building.usageType ? toTitleCase(building.usageType) : (building.category ? toTitleCase(building.category) : toTitleCase(building.defId)) },
      { label: 'Position', value: `(${building.cell.x}, ${building.cell.y})` },
      { label: 'Size', value: `${building.footprint.width}x${building.footprint.height}` },
    ];
    if (building.category) {
      infoRows.push({ label: 'Category', value: toTitleCase(building.category) });
    }
    sections.push({ id: 'info', title: 'Info', rows: infoRows });

    // 床位专属区块
    if (building.bed) {
      const bed = building.bed;
      const ownerLabel = bed.ownerPawnId ?? 'Unassigned';
      const occupantLabel = bed.occupantPawnId ?? 'Empty';

      sections.push({
        id: 'bed',
        title: 'Bed',
        rows: [
          { label: 'Role', value: toTitleCase(bed.role) },
          { label: 'Owner', value: ownerLabel },
          { label: 'Occupant', value: occupantLabel },
        ],
      });

      // 床位操作
      actions.push({
        id: 'assign_bed_owner',
        label: 'Assign Owner',
        enabled: true,
      });
      actions.push({
        id: 'clear_bed_owner',
        label: 'Clear Owner',
        enabled: bed.ownerPawnId !== null,
      });
    }

    /** 从快照中获取可分配的殖民者列表 */
    const availableOwners = Object.values(context.snapshot.colonists)
      .map(c => ({ id: c.id, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      mode: 'specialized',
      targetId: context.targetId,
      title: building.label,
      subtitle: 'Building',
      stack: context.stack,
      sections,
      actions,
      renderBody: (callbacks: InspectorBodyCallbacks) => (
        <>
          <Section title="Info">
            {infoRows.map(row => (
              <StatRow key={row.label} label={row.label} value={row.value} />
            ))}
          </Section>

          {building.bed && (
            <Section title="Bed">
              <StatRow label="Role" value={toTitleCase(building.bed.role)} />
              <StatRow label="Owner" value={building.bed.ownerPawnId ?? 'Unassigned'} />
              <StatRow label="Occupant" value={building.bed.occupantPawnId ?? 'Empty'} />
              <div class="bed-owner-controls">
                <select
                  onInput={(e) => {
                    const value = (e.currentTarget as HTMLSelectElement).value;
                    if (value) callbacks.onAssignBedOwner(context.targetId, value);
                  }}
                >
                  <option value="" disabled selected>Assign owner</option>
                  {availableOwners.map((owner) => (
                    <option key={owner.id} value={owner.id}>{owner.label}</option>
                  ))}
                </select>
                <button type="button" onClick={() => callbacks.onClearBedOwner(context.targetId)}>
                  Clear Owner
                </button>
              </div>
            </Section>
          )}
        </>
      ),
    };
  },
};
