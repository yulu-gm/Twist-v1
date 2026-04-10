export type MainPanel = 'colonists' | 'build' | 'feedback';

export type InspectorTab = 'overview' | 'needs' | 'job';

export interface UiState {
  activePanel: MainPanel;
  inspectorTab: InspectorTab;
  colonistSort: 'name' | 'mood' | 'job';
  colonistSearch: string;
  buildSearch: string;
  notificationCenterOpen: boolean;
  pinnedColonistId: string | null;
}

export interface PresentationSnapshot {
  activeTool: string;
  activeDesignationType: string | null;
  activeZoneType: string | null;
  activeBuildDefId: string | null;
  hoveredCell: { x: number; y: number } | null;
  selectedIds: string[];
  showDebugPanel: boolean;
  showGrid: boolean;
}

export interface SelectionSnapshot {
  primaryId: string | null;
  selectedIds: string[];
}

export interface ColonistNode {
  id: string;
  name: string;
  cell: { x: number; y: number };
  factionId: string;
  currentJob: string;
  currentJobLabel: string;
  needs: { food: number; rest: number; joy: number; mood: number };
  health: { hp: number; maxHp: number };
}

export interface BuildingNode {
  id: string;
  label: string;
  defId: string;
  cell: { x: number; y: number };
  footprint: { width: number; height: number };
  category?: 'structure' | 'furniture';
  usageType?: 'bed' | 'table' | 'chair' | 'storage';
  bed?: {
    role: 'public' | 'owned' | 'medical' | 'prisoner';
    ownerPawnId: string | null;
    occupantPawnId: string | null;
    autoAssignable: boolean;
  };
}

export interface BuildSnapshot {
  activeTool: string;
  activeDesignationType: string | null;
  activeZoneType: string | null;
  lastZoneType: string;
  activeBuildDefId: string | null;
  activeModeLabel: string;
}

export interface FeedbackSnapshot {
  recentEvents: Array<{ type: string; tick: number; summary: string }>;
}

export interface EngineSnapshot {
  tick: number;
  speed: number;
  clockDisplay: string;
  colonistCount: number;
  presentation: PresentationSnapshot;
  selection: SelectionSnapshot;
  colonists: Record<string, ColonistNode>;
  buildings?: Record<string, BuildingNode>;
  build: BuildSnapshot;
  feedback: FeedbackSnapshot;
  debugInfo: string;
}
