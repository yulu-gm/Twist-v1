import type { GameMap } from '../../world/game-map';
import type { Zone } from '../../world/game-map';

export function getAllZones(map: GameMap): Zone[] {
  return map.zones.getAll();
}

export function getZoneAt(map: GameMap, key: string): Zone | undefined {
  return map.zones.getZoneAt(key);
}
