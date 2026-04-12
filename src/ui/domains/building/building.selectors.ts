/**
 * @file building.selectors.ts
 * @description 建筑检视面板的选择器函数 — 从引擎快照中提取并转换建筑检视数据
 * @dependencies ui/kernel/ui-types, building.types
 * @part-of ui/domains/building — 建筑 UI 领域
 */

import type { BuildingNode, ColonistNode, EngineSnapshot, UiState } from '../../kernel/ui-types';
import type { BedInspectorDetailViewModel, BuildingInspectorBaseViewModel, BuildingInspectorViewModel } from './building.types';

/** 从引擎快照中提取当前选中建筑的检视面板视图模型，无选中或选中非建筑时返回 null */
export function selectBuildingInspector(
  snapshot: EngineSnapshot,
  _uiState: UiState,
): BuildingInspectorViewModel | null {
  const primaryId = snapshot.selection.primaryId;
  if (!primaryId) return null;

  const building = snapshot.buildings?.[primaryId];
  if (!building) return null;

  const base: BuildingInspectorBaseViewModel = {
    id: building.id,
    label: building.label,
    stats: buildStats(building),
  };

  /* 床位建筑返回带 detail 的 bed 类型，其余返回 generic */
  if (building.bed) {
    const detail = buildBedDetail(building, snapshot.colonists);
    return { kind: 'bed', base, detail };
  }

  return { kind: 'generic', base };
}

/** 根据建筑节点数据生成通用属性统计列表（不含床位专属行） */
function buildStats(building: BuildingNode): Array<{ label: string; value: string }> {
  const stats = [
    { label: 'Type', value: formatBuildingType(building) },
    { label: 'Position', value: `(${building.cell.x}, ${building.cell.y})` },
    { label: 'Size', value: `${building.footprint.width}x${building.footprint.height}` },
  ];

  if (building.category) {
    stats.push({ label: 'Category', value: toTitleCase(building.category) });
  }

  return stats;
}

/** 根据建筑床位数据和殖民者列表生成床位专属详情 */
function buildBedDetail(
  building: BuildingNode,
  colonists: Record<string, ColonistNode>,
): BedInspectorDetailViewModel {
  const bed = building.bed!;
  /* 按名称排序的可分配殖民者列表 */
  const availableOwners = Object.values(colonists)
    .map(c => ({ id: c.id, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    role: toTitleCase(bed.role),
    ownerLabel: bed.ownerPawnId ?? 'Unassigned',
    occupantLabel: bed.occupantPawnId ?? 'Empty',
    availableOwners,
  };
}

/** 格式化建筑类型为显示字符串，优先使用使用类型，其次分类，最后用定义ID */
function formatBuildingType(building: BuildingNode): string {
  if (building.usageType) return toTitleCase(building.usageType);
  if (building.category) return toTitleCase(building.category);
  return toTitleCase(building.defId);
}

/** 将下划线分隔的标识符转换为首字母大写的可读文本 */
function toTitleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
