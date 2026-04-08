import { DefId, CellCoord, MapId, ObjectKind, nextObjectId, Tag } from '../../core/types';
import { Plant } from './plant.types';
import type { DefDatabase } from '../../world/def-database';

export function createPlant(params: {
  defId: DefId;
  cell: CellCoord;
  mapId: MapId;
  sownByPlayer?: boolean;
  growthProgress?: number;
  defs?: DefDatabase;
}): Plant {
  const growthProgress = params.growthProgress ?? 0;

  // Start with base tag, then merge tags from Def if available
  const tags = new Set<Tag>(['plant']);
  if (params.defs) {
    const plantDef = params.defs.plants.get(params.defId);
    if (plantDef) {
      for (const t of plantDef.tags) tags.add(t);
    }
  }

  return {
    id: nextObjectId(),
    kind: ObjectKind.Plant,
    defId: params.defId,
    mapId: params.mapId,
    cell: { x: params.cell.x, y: params.cell.y },
    tags,
    destroyed: false,
    growthProgress,
    growthStage: 0,
    sownByPlayer: params.sownByPlayer ?? false,
    harvestReady: false,
    dyingProgress: 0,
  };
}
