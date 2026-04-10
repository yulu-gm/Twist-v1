import type { BuildingNode, EngineSnapshot, UiState } from '../../kernel/ui-types';
import type { BuildingInspectorViewModel } from './building.types';

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

function formatBuildingType(building: BuildingNode): string {
  if (building.usageType) return toTitleCase(building.usageType);
  if (building.category) return toTitleCase(building.category);
  return toTitleCase(building.defId);
}

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
