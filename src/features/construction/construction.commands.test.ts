import { describe, expect, it } from 'vitest';
import { ObjectKind, JobState } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../pawn/pawn.factory';
import { createItem } from '../item/item.factory';
import { createHaulJob } from '../ai/jobs/haul-job';
import { cancelConstructionHandler } from './construction.commands';

function createTestWorld() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 12345 });
  const map = createGameMap({ id: 'main', width: 12, height: 12 });
  world.maps.set(map.id, map);

  const pawn = createPawn({
    name: 'Alice',
    cell: { x: 2, y: 2 },
    mapId: map.id,
    factionId: 'player',
    rng: world.rng,
  });
  map.objects.add(pawn);

  return { defs, world, map, pawn };
}

describe('cancelConstructionHandler', () => {
  it('cleans up pawns targeting a cancelled construction object through cleanup', () => {
    const { defs, world, map, pawn } = createTestWorld();
    const blueprint = {
      id: 'bp_1',
      kind: ObjectKind.Blueprint,
      defId: 'blueprint_test',
      mapId: map.id,
      cell: { x: 6, y: 6 },
      footprint: { width: 1, height: 1 },
      tags: new Set(['blueprint', 'construction']),
      destroyed: false,
      targetDefId: 'test_building',
      rotation: 0,
      materialsRequired: [],
      materialsDelivered: [],
    };
    map.objects.add(blueprint as never);

    pawn.inventory.carrying = { defId: 'wood', count: 4 };

    const job = {
      id: 'job_construct_1',
      defId: 'job_construct',
      pawnId: pawn.id,
      targetId: blueprint.id,
      targetCell: blueprint.cell,
      toils: [],
      currentToilIndex: 0,
      reservations: [map.reservations.tryReserve({
        claimantId: pawn.id,
        targetId: blueprint.id,
        jobId: 'job_construct_1',
        currentTick: world.tick,
      }) as string],
      state: JobState.Active,
    };
    pawn.ai.currentJob = job;
    pawn.ai.currentToilIndex = 0;
    pawn.ai.toilState = { working: true };

    const result = cancelConstructionHandler.execute(world, {
      type: 'cancel_construction',
      payload: { targetId: blueprint.id },
    });

    expect(result.events.some(event => event.type === 'construction_cancelled')).toBe(true);
    expect(pawn.ai.currentJob).toBeNull();
    expect(pawn.inventory.carrying).toBeNull();
    expect(map.reservations.isReserved(blueprint.id)).toBe(false);
  });

  it('cleans up haul jobs that are delivering to the cancelled blueprint', () => {
    const { defs, world, map, pawn } = createTestWorld();
    const blueprint = {
      id: 'bp_haul_1',
      kind: ObjectKind.Blueprint,
      defId: 'blueprint_test',
      mapId: map.id,
      cell: { x: 6, y: 6 },
      footprint: { width: 1, height: 1 },
      tags: new Set(['blueprint', 'construction']),
      destroyed: false,
      targetDefId: 'test_building',
      rotation: 0,
      materialsRequired: [{ defId: 'wood', count: 10 }],
      materialsDelivered: [{ defId: 'wood', count: 0 }],
    };
    map.objects.add(blueprint as never);

    const item = createItem({
      defId: 'wood',
      cell: { x: 4, y: 2 },
      mapId: map.id,
      stackCount: 15,
      defs,
    });
    map.objects.add(item);

    const job = createHaulJob(pawn.id, item.id, item.cell, blueprint.cell, 5, blueprint.id);
    const resId = map.reservations.tryReserve({
      claimantId: pawn.id,
      targetId: item.id,
      jobId: job.id,
      currentTick: world.tick,
    });
    expect(resId).not.toBeNull();

    job.reservations.push(resId as string);
    pawn.ai.currentJob = job;
    pawn.ai.currentToilIndex = 2;
    pawn.ai.toilState = { working: true };
    pawn.inventory.carrying = { defId: 'wood', count: 5 };

    const result = cancelConstructionHandler.execute(world, {
      type: 'cancel_construction',
      payload: { targetId: blueprint.id },
    });

    expect(result.events.some(event => event.type === 'construction_cancelled')).toBe(true);
    expect(pawn.ai.currentJob).toBeNull();
    expect(pawn.inventory.carrying).toBeNull();
    expect(map.reservations.isReserved(item.id)).toBe(false);
  });
});
