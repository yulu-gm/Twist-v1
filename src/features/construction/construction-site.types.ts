import {
  MapObjectBase, ObjectKind, DefId, Rotation,
} from '../../core/types';

export interface ConstructionSite extends MapObjectBase {
  kind: ObjectKind.ConstructionSite;
  targetDefId: DefId;
  rotation: Rotation;
  buildProgress: number;      // 0 to 1
  totalWorkAmount: number;
  workDone: number;
}
