import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import type { Item } from './item.types';

export function getAllItems(map: GameMap): Item[] {
  return map.objects.allOfKind(ObjectKind.Item) as unknown as Item[];
}

export function getItemById(map: GameMap, id: string): Item | undefined {
  const obj = map.objects.get(id);
  if (obj && obj.kind === ObjectKind.Item) return obj as unknown as Item;
  return undefined;
}

export function getItemsAt(map: GameMap, x: number, y: number): Item[] {
  const ids = map.objects.allWithTag('haulable');
  return (ids as unknown as Item[]).filter(i => i.cell.x === x && i.cell.y === y);
}
