import type { GameMap } from '../../world/game-map';
import { ObjectKind } from '../../core/types';
import type { Blueprint } from './blueprint.types';
import type { ConstructionSite } from './construction-site.types';

export function getAllBlueprints(map: GameMap): Blueprint[] {
  return map.objects.allOfKind(ObjectKind.Blueprint) as unknown as Blueprint[];
}

export function getAllConstructionSites(map: GameMap): ConstructionSite[] {
  return map.objects.allOfKind(ObjectKind.ConstructionSite) as unknown as ConstructionSite[];
}
