import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createBuilding } from './building.factory';
import {
  getAllBeds,
  getBedByOwner,
  isBedAvailable,
  isBedOwnedBy,
} from './building.queries';

describe('building furniture support', () => {
  it('attaches furniture and bed components from the building def', () => {
    const defs = buildDefDatabase();
    const bed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 4, y: 5 },
      mapId: 'main',
      defs,
    });

    expect(bed.category).toBe('furniture');
    expect(bed.furniture?.usageType).toBe('bed');
    expect(bed.bed).toMatchObject({
      role: 'public',
      autoAssignable: true,
      restRateMultiplier: 1.25,
      moodBonus: 5,
    });
  });

  it('finds beds by owner and availability', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const ownedBed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 2, y: 2 },
      mapId: map.id,
      defs,
    });
    ownedBed.bed!.ownerPawnId = 'Alice';

    const occupiedBed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 4, y: 2 },
      mapId: map.id,
      defs,
    });
    occupiedBed.bed!.occupantPawnId = 'pawn_bob';

    const freeBed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 6, y: 2 },
      mapId: map.id,
      defs,
    });

    map.objects.add(ownedBed);
    map.objects.add(occupiedBed);
    map.objects.add(freeBed);

    expect(getAllBeds(map)).toHaveLength(3);
    expect(getBedByOwner(map, 'Alice')?.id).toBe(ownedBed.id);
    expect(isBedOwnedBy(ownedBed, 'Alice')).toBe(true);
    expect(isBedAvailable(occupiedBed)).toBe(false);
    expect(isBedAvailable(freeBed)).toBe(true);
  });
});
