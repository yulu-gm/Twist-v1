import {
  MapObjectBase, ObjectKind, DefId, Rotation, MaterialReq,
} from '../../core/types';

export interface Blueprint extends MapObjectBase {
  kind: ObjectKind.Blueprint;
  targetDefId: DefId;
  rotation: Rotation;
  materialsRequired: MaterialReq[];
  materialsDelivered: MaterialReq[];
}
