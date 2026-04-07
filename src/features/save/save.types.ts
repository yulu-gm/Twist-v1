import { SimSpeed, MapId, TerrainDefId } from '../../core/types';

export interface SaveData {
  version: number;
  tick: number;
  clockState: {
    totalTicks: number;
    hour: number;
    day: number;
    season: number;
    year: number;
  };
  rngState: number;
  speed: SimSpeed;
  maps: MapSaveData[];
  factions: { id: string; name: string; isPlayer: boolean; hostile: boolean }[];
  storyState: { threatLevel: number; daysSinceLastRaid: number; totalWealth: number };
  nextObjectId: number;
}

export interface MapSaveData {
  id: MapId;
  width: number;
  height: number;
  terrain: TerrainDefId[];  // flat array, row-major
  objects: any[];  // serialized MapObjects
  zones: any[];
  reservations: any[];
}
