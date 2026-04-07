import { ObjectKind, nextObjectId } from '../../core/types';
import type { CellCoord, DefId, MapId } from '../../core/types';
import type { DefDatabase } from '../../world/def-database';
import type { Item } from './item.types';

export function createItem(params: {
  defId: DefId;
  cell: CellCoord;
  mapId: MapId;
  stackCount?: number;
  defs: DefDatabase;
}): Item {
  const { defId, cell, mapId, stackCount, defs } = params;
  const def = defs.items.get(defId);

  const maxStack = def?.maxStack ?? 75;
  const tags = new Set<string>(def?.tags ?? []);
  tags.add('haulable');
  tags.add('selectable');

  return {
    id: nextObjectId(),
    kind: ObjectKind.Item,
    defId,
    mapId,
    cell: { x: cell.x, y: cell.y },
    tags,
    destroyed: false,
    stackCount: stackCount ?? 1,
    maxStack,
  };
}
