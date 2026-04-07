import { ObjectId, CellCoord, DefId, Rotation } from '../core/types';

export enum OverlayType {
  None = 'none',
  Temperature = 'temperature',
  Beauty = 'beauty',
  Zones = 'zones',
  Rooms = 'rooms',
  Pathfinding = 'pathfinding',
}

export interface PlacementPreview {
  defId: DefId;
  cell: CellCoord;
  rotation: Rotation;
  valid: boolean;
}

export interface PresentationState {
  selectedObjectIds: Set<ObjectId>;
  hoveredCell: CellCoord | null;
  placementPreview: PlacementPreview | null;
  activeOverlay: OverlayType;
  cameraPosition: { x: number; y: number };
  cameraZoom: number;
  activeTool: ToolType;
  showDebugPanel: boolean;
}

export enum ToolType {
  Select = 'select',
  Build = 'build',
  Designate = 'designate',
  Zone = 'zone',
}

export function createPresentationState(): PresentationState {
  return {
    selectedObjectIds: new Set(),
    hoveredCell: null,
    placementPreview: null,
    activeOverlay: OverlayType.None,
    cameraPosition: { x: 0, y: 0 },
    cameraZoom: 1,
    activeTool: ToolType.Select,
    showDebugPanel: false,
  };
}
