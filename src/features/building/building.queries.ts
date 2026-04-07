import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import type { Building } from './building.types';

export function getAllBuildings(map: GameMap): Building[] {
  return map.objects.allOfKind(ObjectKind.Building) as unknown as Building[];
}

export function getBuildingById(map: GameMap, id: string): Building | undefined {
  const obj = map.objects.get(id);
  if (obj && obj.kind === ObjectKind.Building) return obj as unknown as Building;
  return undefined;
}
