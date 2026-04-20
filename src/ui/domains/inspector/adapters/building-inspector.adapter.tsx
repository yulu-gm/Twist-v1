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

/** 家具/分类标签的本地化映射 — 替代原 toTitleCase 的英文 fallback */
const USAGE_TYPE_LABELS: Record<string, string> = {
  bed: '床',
  table: '桌子',
  chair: '椅子',
  storage: '仓储',
};
const CATEGORY_LABELS: Record<string, string> = {
  furniture: '家具',
  structure: '结构',
};
const BED_ROLE_LABELS: Record<string, string> = {
  public: '公共',
  owned: '私有',
  medical: '医疗',
  prisoner: '囚犯',
};

/** 优先用映射表，未命中则保留原 defId */
function localizeUsageType(value: string): string {
  return USAGE_TYPE_LABELS[value] ?? value;
}
function localizeCategory(value: string): string {
  return CATEGORY_LABELS[value] ?? value;
}
function localizeBedRole(value: string): string {
  return BED_ROLE_LABELS[value] ?? value;
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

    // 通用信息区块 — Type 行直接展示已中文化的 building.label
    const infoRows = [
      { label: '类型', value: building.label },
      { label: '坐标', value: `(${building.cell.x}, ${building.cell.y})` },
      { label: '尺寸', value: `${building.footprint.width}x${building.footprint.height}` },
    ];
    if (building.category) {
      infoRows.push({ label: '分类', value: localizeCategory(building.category) });
    }
    if (building.usageType) {
      infoRows.push({ label: '用途', value: localizeUsageType(building.usageType) });
    }
    sections.push({ id: 'info', title: '信息', rows: infoRows });

    // 仓库专属区块 — 容量/种类摘要
    if (building.storage) {
      sections.push({
        id: 'storage',
        title: '仓储',
        rows: [
          { label: '容量', value: `${building.storage.storedCount}/${building.storage.capacityMax}` },
          { label: '物品种类', value: String(building.storage.typeCount) },
          { label: '总数', value: String(building.storage.storedCount) },
        ],
      });
    }

    // 床位专属区块
    if (building.bed) {
      const bed = building.bed;
      const ownerLabel = bed.ownerPawnId ?? '未指派';
      const occupantLabel = bed.occupantPawnId ?? '空闲';

      sections.push({
        id: 'bed',
        title: '床位',
        rows: [
          { label: '角色', value: localizeBedRole(bed.role) },
          { label: '所有者', value: ownerLabel },
          { label: '占用者', value: occupantLabel },
        ],
      });

      // 床位操作
      actions.push({
        id: 'assign_bed_owner',
        label: '指派所有者',
        enabled: true,
      });
      actions.push({
        id: 'clear_bed_owner',
        label: '清除所有者',
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
      subtitle: '建筑',
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
                <Section title="信息">
                  {infoRows.map(row => (
                    <StatRow key={row.label} label={row.label} value={row.value} />
                  ))}
                </Section>
                <Section title="仓储">
                  <StatRow label="容量" value={`${storage.storedCount}/${storage.capacityMax}`} />
                  <StatRow label="物品种类" value={String(storage.typeCount)} />
                  <StatRow label="总数" value={String(storage.storedCount)} />
                </Section>
                <Section title="控制台">
                  <div class="warehouse-inspector__future-panel">入库 / 出库 / 优先级</div>
                </Section>
              </div>
              <div class="warehouse-inventory">
                <div class="warehouse-inventory__header">
                  <span>库存</span>
                  <span>{storage.typeCount} 种 / 共 {storage.storedCount}</span>
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
            <Section title="信息">
              {infoRows.map(row => (
                <StatRow key={row.label} label={row.label} value={row.value} />
              ))}
            </Section>

            {building.bed && (
              <Section title="床位">
                <StatRow label="角色" value={localizeBedRole(building.bed.role)} />
                <StatRow label="所有者" value={building.bed.ownerPawnId ?? '未指派'} />
                <StatRow label="占用者" value={building.bed.occupantPawnId ?? '空闲'} />
                <div class="bed-owner-controls">
                  <select
                    onInput={(e) => {
                      const value = (e.currentTarget as HTMLSelectElement).value;
                      if (value) callbacks.onAssignBedOwner(context.targetId, value);
                    }}
                  >
                    <option value="" disabled selected>指派所有者</option>
                    {availableOwners.map((owner) => (
                      <option key={owner.id} value={owner.id}>{owner.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => callbacks.onClearBedOwner(context.targetId)}>
                    清除所有者
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
