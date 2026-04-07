import { DefId, CellCoord, MapId, ObjectKind, nextObjectId } from '../../core/types';
import { Plant } from './plant.types';

export function createPlant(params: {
  defId: DefId;
  cell: CellCoord;
  mapId: MapId;
  sownByPlayer?: boolean;
  growthProgress?: number;
}): Plant {
  const growthProgress = params.growthProgress ?? 0;

  return {
    id: nextObjectId(),
    kind: ObjectKind.Plant,
    defId: params.defId,
    mapId: params.mapId,
    cell: { x: params.cell.x, y: params.cell.y },
    tags: new Set(['plant']),
    destroyed: false,
    growthProgress,
    growthStage: 0,
    sownByPlayer: params.sownByPlayer ?? false,
    harvestReady: false,
    dyingProgress: 0,
  };
}
