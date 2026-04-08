import { ObjectId, CellCoord, DefId, Rotation, DesignationType } from '../core/types';

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

export interface DesignationPreview {
  cell: CellCoord;
  designationType: DesignationType;
  valid: boolean;
}

export interface PresentationState {
  selectedObjectIds: Set<ObjectId>;
  hoveredCell: CellCoord | null;
  placementPreview: PlacementPreview | null;
  designationPreview: DesignationPreview | null;
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
    designationPreview: null,
    activeOverlay: OverlayType.None,
    cameraPosition: { x: 0, y: 0 },
    cameraZoom: 1,
    activeTool: ToolType.Select,
    showDebugPanel: false,
  };
}
