import { Section } from '../../../components/section';
import { StatRow } from '../../../components/stat-row';
import type { BuildingInspectorViewModel } from '../building.types';

interface BuildingInspectorProps {
  viewModel: BuildingInspectorViewModel;
  onAssignOwner?: (bedId: string, pawnId: string) => void;
  onClearOwner?: (bedId: string) => void;
}

export function BuildingInspector({ viewModel, onAssignOwner, onClearOwner }: BuildingInspectorProps) {
  return (
    <div class="inspector-panel">
      <div class="inspector-panel__header">{viewModel.base.label}</div>
      <div class="inspector-panel__body">
        <Section title="Info">
          {viewModel.base.stats.map((stat) => (
            <StatRow key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </Section>

        {viewModel.kind === 'bed' && (
          <Section title="Bed">
            <StatRow label="Role" value={viewModel.detail.role} />
            <StatRow label="Owner" value={viewModel.detail.ownerLabel} />
            <StatRow label="Occupant" value={viewModel.detail.occupantLabel} />
            <div class="bed-owner-controls">
              <select
                onInput={(e) => {
                  const value = (e.currentTarget as HTMLSelectElement).value;
                  if (value) onAssignOwner?.(viewModel.base.id, value);
                }}
              >
                <option value="" disabled selected>Assign owner</option>
                {viewModel.detail.availableOwners.map((owner) => (
                  <option key={owner.id} value={owner.id}>{owner.label}</option>
                ))}
              </select>
              <button type="button" onClick={() => onClearOwner?.(viewModel.base.id)}>
                Clear Owner
              </button>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
