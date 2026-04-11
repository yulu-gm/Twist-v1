/**
 * @file building.selectors.ts
 * @description 建筑检视面板的选择器函数 — 从引擎快照中提取并转换建筑检视数据
 * @dependencies ui/kernel/ui-types, building.types
 * @part-of ui/domains/building — 建筑 UI 领域
 */

import type { BuildingNode, EngineSnapshot, UiState } from '../../kernel/ui-types';
import type { BuildingInspectorViewModel } from './building.types';

/** 从引擎快照中提取当前选中建筑的检视面板视图模型，无选中或选中非建筑时返回 null */
export function selectBuildingInspector(
  snapshot: EngineSnapshot,
  _uiState: UiState,
): BuildingInspectorViewModel | null {
  const primaryId = snapshot.selection.primaryId;
  if (!primaryId) return null;

  const building = snapshot.buildings?.[primaryId];
  if (!building) return null;

  return {
    id: building.id,
    label: building.label,
    stats: buildStats(building),
  };
}

/** 根据建筑节点数据生成属性统计列表 */
function buildStats(building: BuildingNode): Array<{ label: string; value: string }> {
  const stats = [
    { label: 'Type', value: formatBuildingType(building) },
    { label: 'Position', value: `(${building.cell.x}, ${building.cell.y})` },
    { label: 'Size', value: `${building.footprint.width}x${building.footprint.height}` },
  ];

  if (building.category) {
    stats.push({ label: 'Category', value: toTitleCase(building.category) });
  }

  if (building.bed) {
    stats.push({ label: 'Role', value: toTitleCase(building.bed.role) });
    stats.push({ label: 'Owner', value: building.bed.ownerPawnId ?? 'Unassigned' });
    stats.push({ label: 'Occupant', value: building.bed.occupantPawnId ?? 'Empty' });
    stats.push({ label: 'Auto Assign', value: building.bed.autoAssignable ? 'Yes' : 'No' });
  }

  return stats;
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
