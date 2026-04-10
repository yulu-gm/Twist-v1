import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createWorld } from '../../world/world';
import { createGameMap } from '../../world/game-map';
import { createPawn } from '../pawn/pawn.factory';
import { createBuilding } from '../building/building.factory';
import { jobSelectionSystem } from './job-selector';
import { toilExecutorSystem } from './toil-executor';
import { movementSystem } from '../movement/movement.system';

describe('sleep behavior', () => {
  it('assigns a sleep job that targets an available bed when rest is low', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 1 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Sleeper',
      cell: { x: 10, y: 10 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 10;

    const bed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 12, y: 10 },
      mapId: map.id,
      defs,
    });

    map.objects.add(pawn);
    map.objects.add(bed);

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_sleep');
    expect(pawn.ai.currentJob?.targetId).toBe(bed.id);
    expect(bed.bed?.ownerPawnId).toBe(pawn.name);
  });

  it('moves a bed sleeper onto the bed footprint while sleeping', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 11 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'BedSleeper',
      cell: { x: 10, y: 14 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 10;

    const bed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 12, y: 10 },
      mapId: map.id,
      defs,
    });

    map.objects.add(pawn);
    map.objects.add(bed);

    jobSelectionSystem.execute(world);

    for (let i = 0; i < 120; i++) {
      toilExecutorSystem.execute(world);
      movementSystem.execute(world);

      if (bed.bed?.occupantPawnId === pawn.id) {
        break;
      }
    }

    expect(bed.bed?.occupantPawnId).toBe(pawn.id);
    expect([
      { x: bed.cell.x, y: bed.cell.y },
      { x: bed.cell.x, y: bed.cell.y + 1 },
    ]).toContainEqual(pawn.cell);
    expect(pawn.cell).not.toEqual(bed.interaction?.interactionCell);
  });

  it('falls back to floor sleep when no bed is available', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 2 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'FloorSleeper',
      cell: { x: 6, y: 6 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 10;
    map.objects.add(pawn);

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_sleep');
    expect(pawn.ai.currentJob?.targetId).toBeUndefined();
  });

  it('restores rest while sleeping on the floor', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 3 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Nap',
      cell: { x: 8, y: 8 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 10;
    map.objects.add(pawn);

    jobSelectionSystem.execute(world);
    expect(pawn.ai.currentJob?.defId).toBe('job_sleep');

    for (let i = 0; i < 200 && pawn.ai.currentJob; i++) {
      toilExecutorSystem.execute(world);
    }

    expect(pawn.ai.currentJob).toBeNull();
    expect(pawn.needs.rest).toBeGreaterThanOrEqual(pawn.needsProfile.wakeTargetRest);
  });
});
