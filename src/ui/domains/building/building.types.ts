export interface BuildingInspectorStat {
  label: string;
  value: string;
}

export interface BuildingInspectorViewModel {
  id: string;
  label: string;
  stats: BuildingInspectorStat[];
}
