import { ObjectKind, MapObjectBase, ObjectId } from '../../core/types';

export interface Corpse extends MapObjectBase {
  kind: ObjectKind.Corpse;
  originalPawnId: ObjectId;
  decayProgress: number;  // 0~1, 1=fully decayed
}
