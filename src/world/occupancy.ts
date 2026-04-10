import {
  ObjectId, MapObjectBase, Footprint, CellCoord, byId,
} from '../core/types';
import type { GameMap } from './game-map';

export const PHYSICAL_OCCUPANT_TAG = 'physical_occupant' as const;

export interface OccupancyQueryOptions {
  ignoreIds?: Iterable<ObjectId>;
}

const DEFAULT_FOOTPRINT: Footprint = { width: 1, height: 1 };

function getFootprintBounds(origin: CellCoord, footprint: Footprint): { min: CellCoord; max: CellCoord } {
  return {
    min: { x: origin.x, y: origin.y },
    max: {
      x: origin.x + footprint.width - 1,
      y: origin.y + footprint.height - 1,
    },
  };
}

function toIgnoreSet(ignoreIds?: Iterable<ObjectId>): Set<ObjectId> {
  return new Set(ignoreIds ?? []);
}

/**
 * Return all objects touched by a footprint, deduplicated and sorted by id.
 * Destroyed objects are excluded.
 */
export function getObjectsInFootprint(
  map: GameMap,
  origin: CellCoord,
  footprint: Footprint = DEFAULT_FOOTPRINT,
  options: OccupancyQueryOptions = {},
): MapObjectBase[] {
  if (footprint.width <= 0 || footprint.height <= 0) return [];

  const { min, max } = getFootprintBounds(origin, footprint);
  const ignoreSet = toIgnoreSet(options.ignoreIds);
  const seen = new Set<ObjectId>();
  const result: MapObjectBase[] = [];

  for (const id of map.spatial.getInRect(min, max)) {
    if (seen.has(id) || ignoreSet.has(id)) continue;
    seen.add(id);

    const obj = map.objects.get(id);
    if (!obj || obj.destroyed) continue;
    result.push(obj);
  }

  return result.sort(byId);
}

/**
 * Return only physical occupants, based on the shared runtime tag.
 */
export function getPhysicalOccupantsInFootprint(
  map: GameMap,
  origin: CellCoord,
  footprint: Footprint = DEFAULT_FOOTPRINT,
  options: OccupancyQueryOptions = {},
): MapObjectBase[] {
  return getObjectsInFootprint(map, origin, footprint, options).filter(obj => obj.tags.has(PHYSICAL_OCCUPANT_TAG));
}

/**
 * True when at least one physical occupant overlaps the footprint.
 */
export function hasPhysicalOccupantsInFootprint(
  map: GameMap,
  origin: CellCoord,
  footprint: Footprint = DEFAULT_FOOTPRINT,
  options: OccupancyQueryOptions = {},
): boolean {
  return getPhysicalOccupantsInFootprint(map, origin, footprint, options).length > 0;
}
