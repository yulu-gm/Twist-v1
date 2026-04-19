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

    // 仓库专属区块 — 容量/种类摘要
    if (building.storage) {
      sections.push({
        id: 'storage',
        title: 'Storage',
        rows: [
          { label: 'Capacity', value: `${building.storage.storedCount}/${building.storage.capacityMax}` },
          { label: 'Item Types', value: String(building.storage.typeCount) },
          { label: 'Total Count', value: String(building.storage.storedCount) },
        ],
      });
    }

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
      renderBody: (callbacks: InspectorBodyCallbacks) => {
        // 仓库 Inspector — 上半为信息/容量/控制区，底部固定为库存 Dock
        if (building.storage) {
          const storage = building.storage;
          return (
            <div class="warehouse-inspector" data-testid="warehouse-inspector">
              <div class="warehouse-inspector__top">
                <Section title="Info">
                  {infoRows.map(row => (
                    <StatRow key={row.label} label={row.label} value={row.value} />
                  ))}
                </Section>
                <Section title="Storage">
                  <StatRow label="Capacity" value={`${storage.storedCount}/${storage.capacityMax}`} />
                  <StatRow label="Item Types" value={String(storage.typeCount)} />
                  <StatRow label="Total Count" value={String(storage.storedCount)} />
                </Section>
                <Section title="Controls">
                  <div class="warehouse-inspector__future-panel">Incoming / Outgoing / Priority</div>
                </Section>
              </div>
              <div class="warehouse-inventory">
                <div class="warehouse-inventory__header">
                  <span>Inventory</span>
                  <span>{storage.typeCount} types / {storage.storedCount} total</span>
                </div>
                <div class="warehouse-inventory__grid" data-testid="warehouse-inventory-grid">
                  {storage.entries.map(entry => (
                    <div key={entry.defId} class="warehouse-item-card">
                      <span
                        class="warehouse-item-card__swatch"
                        style={{ background: `#${entry.color.toString(16).padStart(6, '0')}` }}
                      />
                      <span class="warehouse-item-card__label">{entry.label}</span>
                      <strong class="warehouse-item-card__count">{entry.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        return (
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
        );
      },
    };
  },
};
