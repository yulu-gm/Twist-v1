import { ObjectKind, Rotation, nextObjectId } from '../../core/types';
import type { CellCoord, DefId, MapId } from '../../core/types';
import type { DefDatabase } from '../../world/def-database';
import type { Building } from './building.types';

export function createBuilding(params: {
  defId: DefId;
  cell: CellCoord;
  mapId: MapId;
  rotation?: Rotation;
  defs: DefDatabase;
}): Building {
  const { defId, cell, mapId, defs } = params;
  const rotation = params.rotation ?? Rotation.North;
  const def = defs.buildings.get(defId);

  const maxHp = def?.maxHp ?? 100;
  const tags = new Set<string>(def?.tags ?? []);
  tags.add('selectable');
  if (def?.blocksMovement) tags.add('impassable');

  const building: Building = {
    id: nextObjectId(),
    kind: ObjectKind.Building,
    defId,
    mapId,
    cell: { x: cell.x, y: cell.y },
    footprint: def?.size ?? { width: 1, height: 1 },
    tags,
    destroyed: false,
    rotation,
    hpCurrent: maxHp,
    hpMax: maxHp,
  };

  // Attach optional power component
  if (def?.powerConsumption !== undefined) {
    building.power = {
      consumption: def.powerConsumption,
      production: 0,
      connected: false,
    };
  }

  // Attach optional storage component
  if (def?.storageConfig) {
    building.storage = {
      allowedDefIds: new Set(def.storageConfig.allowedDefIds),
      priority: def.storageConfig.priority,
    };
  }

  // Attach interaction component if building has an interaction cell
  if (def?.interactionCellOffset) {
    building.interaction = {
      interactionCell: {
        x: cell.x + def.interactionCellOffset.x,
        y: cell.y + def.interactionCellOffset.y,
      },
    };
  }

  return building;
}
