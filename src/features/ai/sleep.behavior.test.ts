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
    // 预先分配床位所有权（不再依赖自动认领）
    bed.bed!.ownerPawnId = pawn.name;

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
    // 预先分配床位所有权（不再依赖自动认领）
    bed.bed!.ownerPawnId = pawn.name;

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

  it('uses the pawn owned bed and never auto-claims an unowned bed', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 10 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'OwnerSleeper',
      cell: { x: 10, y: 10 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 10;

    // 创建 pawn 拥有的床位
    const ownedBed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 12, y: 10 },
      mapId: map.id,
      defs,
    });
    ownedBed.bed!.ownerPawnId = pawn.name;

    // 创建一个无主的闲置床位
    const strayBed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 4, y: 4 },
      mapId: map.id,
      defs,
    });

    map.objects.add(pawn);
    map.objects.add(ownedBed);
    map.objects.add(strayBed);

    jobSelectionSystem.execute(world);

    // 应选中自己拥有的床位
    expect(pawn.ai.currentJob?.defId).toBe('job_sleep');
    expect(pawn.ai.currentJob?.targetId).toBe(ownedBed.id);
    // 无主床不应被自动认领
    expect(strayBed.bed?.ownerPawnId).toBeUndefined();
  });

  it('falls back to floor sleep when another pawn owns the only bed', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 20 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Homeless',
      cell: { x: 10, y: 10 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 10;

    // 创建一个其他 pawn 拥有的床位
    const bed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 12, y: 10 },
      mapId: map.id,
      defs,
    });
    bed.bed!.ownerPawnId = 'SomeoneElse';

    map.objects.add(pawn);
    map.objects.add(bed);

    jobSelectionSystem.execute(world);

    // 没有自己的床位时应就地休息（无 targetId）
    expect(pawn.ai.currentJob?.defId).toBe('job_sleep');
    expect(pawn.ai.currentJob?.targetId).toBeUndefined();
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
