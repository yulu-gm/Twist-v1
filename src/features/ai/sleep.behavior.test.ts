import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createWorld } from '../../world/world';
import { createGameMap } from '../../world/game-map';
import { createPawn } from '../pawn/pawn.factory';
import { createBuilding } from '../building/building.factory';
import { jobSelectionSystem } from './job-selector';
import { toilExecutorSystem } from './toil-executor';
import { movementSystem } from '../movement/movement.system';

function setClockHour(world: ReturnType<typeof createWorld>, hourFloat: number): void {
  let deltaHours = hourFloat - 6;
  if (deltaHours < 0) deltaHours += 24;
  world.tick = Math.round(deltaHours * 100);
  world.clock.totalTicks = Math.round(deltaHours * 100);
  world.clock.hour = Math.floor(hourFloat) % 24;
}

function getActiveToil(pawn: ReturnType<typeof createPawn>) {
  const job = pawn.ai.currentJob;
  expect(job).not.toBeNull();
  return job!.toils[job!.currentToilIndex];
}

describe('sleep behavior', () => {
  it('auto-claims an available unowned bed when rest is low', () => {
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

  it('uses the pawn owned bed before considering other unowned beds', () => {
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

    expect(pawn.ai.currentJob?.defId).toBe('job_sleep');
    expect(pawn.ai.currentJob?.targetId).toBe(ownedBed.id);
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

  it('restores some rest during a full scheduled floor sleep session', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 3 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);
    setClockHour(world, 22);

    const pawn = createPawn({
      name: 'Nap',
      cell: { x: 8, y: 8 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 10;
    pawn.chronotype = {
      scheduleShiftHours: 0,
      sleepStartHour: 22,
      sleepDurationHours: 8,
      sleepEndHour: 30,
      nightOwlBias: 0,
    };
    map.objects.add(pawn);

    jobSelectionSystem.execute(world);
    expect(pawn.ai.currentJob?.defId).toBe('job_sleep');

    for (let i = 0; i < 850 && pawn.ai.currentJob; i++) {
      toilExecutorSystem.execute(world);
    }

    expect(pawn.ai.currentJob).toBeNull();
    expect(pawn.needs.rest).toBeGreaterThan(70);
    expect(pawn.needs.rest).toBeLessThan(pawn.needsProfile.wakeTargetRest);
  });

  it('initializes a scheduled sleep session target for night sleep progress', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 40 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);
    setClockHour(world, 22);

    const pawn = createPawn({
      name: 'NightShift',
      cell: { x: 8, y: 8 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 55;
    pawn.chronotype = {
      scheduleShiftHours: 0,
      sleepStartHour: 22,
      sleepDurationHours: 8,
      sleepEndHour: 30,
      nightOwlBias: 0,
    };

    map.objects.add(pawn);

    jobSelectionSystem.execute(world);
    toilExecutorSystem.execute(world);

    const toil = getActiveToil(pawn);
    expect(toil.type).toBe('wait');
    expect(toil.localData.sleepSessionKind).toBe('scheduled');
    expect(toil.localData.sleepSessionTargetTicks).toBe(800);
  });

  it('initializes a recovery sleep session target outside the scheduled sleep window', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 41 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);
    setClockHour(world, 12);

    const pawn = createPawn({
      name: 'Napper',
      cell: { x: 9, y: 9 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 10;
    map.objects.add(pawn);

    jobSelectionSystem.execute(world);
    toilExecutorSystem.execute(world);

    const toil = getActiveToil(pawn);
    const expectedTicks = Math.ceil(
      (pawn.needsProfile.wakeTargetRest - 10)
      / (pawn.needsProfile.floorRestGainPerTick - pawn.needsProfile.restDecayPerTick),
    );

    expect(toil.type).toBe('wait');
    expect(toil.localData.sleepSessionKind).toBe('recovery');
    expect(toil.localData.sleepSessionTargetTicks).toBe(expectedTicks);
  });

  it('uses a fixed per-tick rest gain during recovery sleep and preserves partial recovery on interruption', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 42 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);
    setClockHour(world, 12);

    const pawn = createPawn({
      name: 'InterruptedNap',
      cell: { x: 10, y: 10 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 10;
    map.objects.add(pawn);

    jobSelectionSystem.execute(world);
    expect(pawn.ai.currentJob?.defId).toBe('job_sleep');

    for (let i = 0; i < 20 && pawn.ai.currentJob; i++) {
      toilExecutorSystem.execute(world);
    }

    pawn.needs.food = 0;
    toilExecutorSystem.execute(world);

    expect(pawn.ai.currentJob).toBeNull();
    expect(pawn.needs.rest).toBeCloseTo(10 + pawn.needsProfile.floorRestGainPerTick * 20, 5);
    expect(pawn.needs.rest).toBeLessThan(pawn.needsProfile.wakeTargetRest);
  });

  it('does not finish a night sleep after only a few dozen ticks', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 30 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);
    setClockHour(world, 22);

    const pawn = createPawn({
      name: 'LongSleeper',
      cell: { x: 10, y: 10 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 55;
    pawn.chronotype = {
      scheduleShiftHours: 0,
      sleepStartHour: 22,
      sleepDurationHours: 8,
      sleepEndHour: 30,
      nightOwlBias: 0,
    };

    const bed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 12, y: 10 },
      mapId: map.id,
      defs,
    });
    bed.bed!.ownerPawnId = pawn.name;

    map.objects.add(pawn);
    map.objects.add(bed);

    jobSelectionSystem.execute(world);

    for (let i = 0; i < 120 && pawn.ai.currentJob; i++) {
      toilExecutorSystem.execute(world);
      movementSystem.execute(world);
    }

    expect(pawn.ai.currentJob?.defId).toBe('job_sleep');
    expect(pawn.needs.rest).toBeLessThan(pawn.needsProfile.wakeTargetRest);
  });

  it('does not nearly fill the rest bar at the start of a scheduled night sleep', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 32 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);
    setClockHour(world, 22);

    const pawn = createPawn({
      name: 'BarAlignmentSleeper',
      cell: { x: 10, y: 10 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 55;
    pawn.chronotype = {
      scheduleShiftHours: 0,
      sleepStartHour: 22,
      sleepDurationHours: 8,
      sleepEndHour: 30,
      nightOwlBias: 0,
    };

    const bed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 12, y: 10 },
      mapId: map.id,
      defs,
    });
    bed.bed!.ownerPawnId = pawn.name;

    map.objects.add(pawn);
    map.objects.add(bed);

    jobSelectionSystem.execute(world);

    for (let i = 0; i < 120 && pawn.ai.currentJob; i++) {
      toilExecutorSystem.execute(world);
      movementSystem.execute(world);
    }

    expect(pawn.ai.currentJob?.defId).toBe('job_sleep');
    expect(pawn.needs.rest).toBeLessThan(75);
  });

  it('wakes after completing the scheduled night sleep window', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 31 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);
    setClockHour(world, 22);

    const pawn = createPawn({
      name: 'ScheduledSleeper',
      cell: { x: 10, y: 10 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 80;
    pawn.needs.rest = 55;
    pawn.chronotype = {
      scheduleShiftHours: 0,
      sleepStartHour: 22,
      sleepDurationHours: 8,
      sleepEndHour: 30,
      nightOwlBias: 0,
    };

    const bed = createBuilding({
      defId: 'bed_wood',
      cell: { x: 12, y: 10 },
      mapId: map.id,
      defs,
    });
    bed.bed!.ownerPawnId = pawn.name;

    map.objects.add(pawn);
    map.objects.add(bed);

    jobSelectionSystem.execute(world);

    for (let i = 0; i < 850 && pawn.ai.currentJob; i++) {
      toilExecutorSystem.execute(world);
      movementSystem.execute(world);
    }

    expect(pawn.ai.currentJob).toBeNull();
    expect(pawn.needs.rest).toBeGreaterThanOrEqual(pawn.needsProfile.wakeTargetRest);
  });
});
