import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createItem } from '../item/item.factory';
import { releaseMissingTargetReservations } from './reservation.cleanup';

describe('releaseMissingTargetReservations', () => {
  it('releases reservations whose target object was removed from the map', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const item = createItem({ defId: 'wood', cell: { x: 4, y: 2 }, mapId: map.id, stackCount: 15, defs });
    map.objects.add(item);
    const resId = map.reservations.tryReserve({
      claimantId: 'pawn_1',
      targetId: item.id,
      jobId: 'job_1',
      currentTick: world.tick,
    });

    expect(resId).not.toBeNull();
    map.objects.remove(item.id);

    releaseMissingTargetReservations(map);

    expect(map.reservations.isReserved(item.id)).toBe(false);
  });
});
