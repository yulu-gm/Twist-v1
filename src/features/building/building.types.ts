import type {
  ObjectKind,
  MapObjectBase,
  Rotation,
  DefId,
  StoragePriority,
  CellCoord,
} from '../../core/types';

// ── Building ──
export interface Building extends MapObjectBase {
  kind: ObjectKind.Building;
  rotation: Rotation;
  hpCurrent: number;
  hpMax: number;
  /** Power consumption/generation. Negative = generates power. */
  power?: {
    consumption: number;
    production: number;
    connected: boolean;
  };
  /** Storage settings if this building acts as a container. */
  storage?: {
    allowedDefIds: Set<DefId>;
    priority: StoragePriority;
  };
  /** Interaction settings if pawns can use this building. */
  interaction?: {
    interactionCell: CellCoord;
  };
}
