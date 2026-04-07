import { DefId, CellCoord, MapId, ObjectKind, ObjectId, nextObjectId } from '../../core/types';
import { Corpse } from './corpse.types';

export function createCorpse(params: {
  originalPawnId: ObjectId;
  defId: DefId;
  cell: CellCoord;
  mapId: MapId;
}): Corpse {
  return {
    id: nextObjectId(),
    kind: ObjectKind.Corpse,
    defId: params.defId,
    mapId: params.mapId,
    cell: { x: params.cell.x, y: params.cell.y },
    tags: new Set(['corpse', 'haulable']),
    destroyed: false,
    originalPawnId: params.originalPawnId,
    decayProgress: 0,
  };
}
