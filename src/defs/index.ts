import { DefDatabase } from '../world/def-database';
import { TERRAIN_DEFS } from './terrains';
import { BUILDING_DEFS } from './buildings';
import { ITEM_DEFS } from './items';
import { PLANT_DEFS } from './plants';
import { JOB_DEFS } from './jobs';

export function buildDefDatabase(): DefDatabase {
  const db = new DefDatabase();

  for (const def of TERRAIN_DEFS) db.registerTerrain(def);
  for (const def of BUILDING_DEFS) db.registerBuilding(def);
  for (const def of ITEM_DEFS) db.registerItem(def);
  for (const def of PLANT_DEFS) db.registerPlant(def);
  for (const def of JOB_DEFS) db.registerJob(def);

  return db;
}
