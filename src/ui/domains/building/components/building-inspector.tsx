import { Section } from '../../../components/section';
import { StatRow } from '../../../components/stat-row';
import type { BuildingInspectorViewModel } from '../building.types';

interface BuildingInspectorProps {
  viewModel: BuildingInspectorViewModel;
}

export function BuildingInspector({ viewModel }: BuildingInspectorProps) {
  return (
    <div class="inspector-panel">
      <div class="inspector-panel__header">{viewModel.label}</div>
      <div class="inspector-panel__body">
        <Section title="Info">
          {viewModel.stats.map((stat) => (
            <StatRow key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </Section>
      </div>
    </div>
  );
}
