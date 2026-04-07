import type { GameMap } from '../../world/game-map';
import { ObjectKind, DesignationType } from '../../core/types';
import type { Designation } from './designation.types';

export function getAllDesignations(map: GameMap): Designation[] {
  return map.objects.allOfKind(ObjectKind.Designation) as unknown as Designation[];
}

export function getDesignationsByType(map: GameMap, type: DesignationType): Designation[] {
  return getAllDesignations(map).filter(d => d.designationType === type);
}
