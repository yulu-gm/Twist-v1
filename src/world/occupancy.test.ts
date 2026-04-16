import { describe, expect, it } from 'vitest';
import { ObjectKind } from '../core/types';
import { buildDefDatabase } from '../defs';
import { createWorld } from './world';
import { createGameMap } from './game-map';
import { createPawn } from '../features/pawn/pawn.factory';
import { createItem } from '../features/item/item.factory';
import { createBuilding } from '../features/building/building.factory';
import { createPlant } from '../features/plant/plant.factory';
import {
  PHYSICAL_OCCUPANT_TAG,
  getObjectsInFootprint,
  getPhysicalOccupantsInFootprint,
  hasPhysicalOccupantsInFootprint,
} from './occupancy';

function createTestMap() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 12345 });
  const map = createGameMap({ id: 'main', width: 12, height: 12 });
  world.maps.set(map.id, map);
  return { defs, world, map };
}

describe('occupancy', () => {
  it('returns only tagged physical occupants inside a footprint', () => {
    const { defs, world, map } = createTestMap();

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 2, y: 2 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    const item = createItem({
      defId: 'wood',
      cell: { x: 2, y: 2 },
      mapId: map.id,
      stackCount: 3,
      defs,
    });
    const plant = createPlant({
      defId: 'tree_oak',
      cell: { x: 3, y: 2 },
      mapId: map.id,
      defs,
    });
    const blueprint = {
      id: 'bp_1',
      kind: ObjectKind.Blueprint,
      defId: 'blueprint_test',
      mapId: map.id,
      cell: { x: 4, y: 4 },
      footprint: { width: 1, height: 1 },
      tags: new Set(['blueprint', 'construction']),
      destroyed: false,
    };

    map.objects.add(pawn);
    map.objects.add(item);
    map.objects.add(plant);
    map.objects.add(blueprint as never);

    const occupants = getPhysicalOccupantsInFootprint(map, { x: 2, y: 2 }, { width: 2, height: 2 });
    expect(occupants.map(obj => obj.id).sort()).toEqual([item.id, pawn.id, plant.id].sort());
    expect(hasPhysicalOccupantsInFootprint(map, { x: 2, y: 2 }, { width: 2, height: 2 })).toBe(true);
    expect(hasPhysicalOccupantsInFootprint(map, { x: 4, y: 4 }, { width: 1, height: 1 })).toBe(false);
    expect(getObjectsInFootprint(map, { x: 4, y: 4 }, { width: 1, height: 1 }).map(obj => obj.id)).toEqual([blueprint.id]);
    expect(blueprint.tags.has(PHYSICAL_OCCUPANT_TAG)).toBe(false);
  });

  it('ignores destroyed objects and explicit ignore ids', () => {
    const { defs, world, map } = createTestMap();

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 5, y: 5 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    const item = createItem({
      defId: 'wood',
      cell: { x: 5, y: 5 },
      mapId: map.id,
      stackCount: 3,
      defs,
    });
    const building = createBuilding({
      defId: 'table',
      cell: { x: 6, y: 5 },
      mapId: map.id,
      defs,
    });

    pawn.destroyed = true;
    map.objects.add(pawn);
    map.objects.add(item);
    map.objects.add(building);

    const occupants = getPhysicalOccupantsInFootprint(map, { x: 5, y: 5 }, { width: 2, height: 1 }, { ignoreIds: [item.id] });
    expect(occupants.map(obj => obj.id)).toEqual([building.id]);
    expect(hasPhysicalOccupantsInFootprint(map, { x: 5, y: 5 }, { width: 2, height: 1 }, { ignoreIds: [item.id] })).toBe(true);
    expect(hasPhysicalOccupantsInFootprint(map, { x: 5, y: 5 }, { width: 2, height: 1 }, { ignoreIds: [item.id, building.id] })).toBe(false);
  });

  it('treats multi-cell footprints as occupied on every covered cell', () => {
    const { defs, map } = createTestMap();

    const table = createBuilding({
      defId: 'table',
      cell: { x: 7, y: 7 },
      mapId: map.id,
      defs,
    });
    map.objects.add(table);

    expect(getObjectsInFootprint(map, { x: 7, y: 7 }, { width: 2, height: 1 }).map(obj => obj.id)).toEqual([table.id]);
    expect(hasPhysicalOccupantsInFootprint(map, { x: 7, y: 7 }, { width: 1, height: 1 })).toBe(true);
    expect(hasPhysicalOccupantsInFootprint(map, { x: 8, y: 7 }, { width: 1, height: 1 })).toBe(true);
    expect(hasPhysicalOccupantsInFootprint(map, { x: 9, y: 7 }, { width: 1, height: 1 })).toBe(false);
  });
});
