import { describe, expect, it } from 'vitest';
import { ObjectKind, ToilState, JobState, ZoneType, cellKey } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../pawn/pawn.factory';
import { createItem } from '../item/item.factory';
import { createHaulJob } from './jobs/haul-job';
import { advanceToil } from './job-lifecycle';
import { jobSelectionSystem } from './job-selector';

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

function makeBlueprint(map: ReturnType<typeof createGameMap>, itemDefId: string) {
  const blueprint = {
    id: 'bp_1',
    kind: ObjectKind.Blueprint,
    defId: 'blueprint_test',
    mapId: map.id,
    cell: { x: 8, y: 8 },
    footprint: { width: 1, height: 1 },
    tags: new Set(['blueprint', 'construction']),
    destroyed: false,
    targetDefId: 'test_building',
    rotation: 0,
    materialsRequired: [{ defId: itemDefId, count: 10 }],
    materialsDelivered: [{ defId: itemDefId, count: 5 }],
  };

  map.objects.add(blueprint as never);
  return blueprint;
}

function addStockpileAt(map: ReturnType<typeof createGameMap>, coord: { x: number; y: number }) {
  map.zones.add({
    id: 'zone_stockpile',
    zoneType: ZoneType.Stockpile,
    cells: new Set([cellKey(coord)]),
    config: {
      stockpile: {
        allowAllHaulable: true,
        allowedDefIds: new Set(),
      },
    },
  });
}

describe('reservation lifecycle', () => {
  it('releases haul reservations when the final toil completes', () => {
    const { defs, world, map, pawn } = createTestWorld();
    const item = createItem({ defId: 'wood', cell: { x: 4, y: 2 }, mapId: map.id, stackCount: 15, defs });
    map.objects.add(item);

    const job = createHaulJob(pawn.id, item.id, item.cell, { x: 8, y: 8 }, 5, 'bp_1');
    const resId = map.reservations.tryReserve({
      claimantId: pawn.id,
      targetId: item.id,
      jobId: job.id,
      currentTick: world.tick,
    });
    expect(resId).not.toBeNull();
    job.reservations.push(resId as string);
    job.currentToilIndex = job.toils.length - 1;
    job.toils[job.currentToilIndex].state = ToilState.Completed;
    job.state = JobState.Active;
    pawn.ai.currentJob = job;
    pawn.ai.currentToilIndex = job.currentToilIndex;

    advanceToil(pawn, job, map, world);

    expect(map.reservations.isReserved(item.id)).toBe(false);
    expect(pawn.ai.currentJob).toBeNull();
    expect(job.state).toBe(JobState.Done);
  });

  it('allows the same stack to be selected again after the reservation is released', () => {
    const { defs, world, map, pawn } = createTestWorld();
    const item = createItem({ defId: 'wood', cell: { x: 4, y: 2 }, mapId: map.id, stackCount: 15, defs });
    map.objects.add(item);
    makeBlueprint(map, item.defId);
    addStockpileAt(map, item.cell);

    const job = createHaulJob(pawn.id, item.id, item.cell, { x: 8, y: 8 }, 5, 'bp_1');
    const resId = map.reservations.tryReserve({
      claimantId: pawn.id,
      targetId: item.id,
      jobId: job.id,
      currentTick: world.tick,
    });
    expect(resId).not.toBeNull();
    job.reservations.push(resId as string);
    job.currentToilIndex = job.toils.length - 1;
    job.toils[job.currentToilIndex].state = ToilState.Completed;
    pawn.ai.currentJob = job;
    pawn.ai.currentToilIndex = job.currentToilIndex;

    advanceToil(pawn, job, map, world);

    expect(map.reservations.isReserved(item.id)).toBe(false);

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob).not.toBeNull();
    expect(pawn.ai.currentJob?.defId).toBe('job_deliver_materials');
    expect(pawn.ai.currentJob?.targetId).toBe(item.id);
  });

});
