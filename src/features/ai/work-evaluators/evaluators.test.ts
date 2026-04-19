/**
 * @file evaluators.test.ts
 * @description 工作评估器单元测试 — 直接测试各 evaluator 的 evaluate() 方法
 * @part-of AI 子系统（features/ai）
 */

import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../../defs';
import { createGameMap } from '../../../world/game-map';
import { createWorld } from '../../../world/world';
import { createItem } from '../../item/item.factory';
import { createPawn } from '../../pawn/pawn.factory';
import { createBuilding } from '../../building/building.factory';
import { eatWorkEvaluator, sleepWorkEvaluator } from './needs.evaluator';
import { wanderWorkEvaluator } from './wander.evaluator';
import { haulToStorageWorkEvaluator } from './hauling.evaluator';
import { constructWorkEvaluator } from './construction.evaluator';

/** 创建标准测试环境 */
function createTestEnv() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 42 });
  const map = createGameMap({ id: 'main', width: 20, height: 20 });
  world.maps.set(map.id, map);
  return { defs, world, map };
}

function setClockHour(env: ReturnType<typeof createTestEnv>, hourFloat: number) {
  let deltaHours = hourFloat - 6;
  if (deltaHours < 0) deltaHours += 24;
  env.world.clock.totalTicks = Math.round(deltaHours * 100);
  env.world.clock.hour = Math.floor(hourFloat) % 24;
}

/** 创建标准测试 pawn */
function createTestPawn(
  env: ReturnType<typeof createTestEnv>,
  overrides: { name?: string; cell?: { x: number; y: number } } = {},
) {
  const pawn = createPawn({
    name: overrides.name ?? 'Tester',
    cell: overrides.cell ?? { x: 5, y: 5 },
    mapId: env.map.id,
    factionId: 'player',
    rng: env.world.rng,
  });
  env.map.objects.add(pawn);
  return pawn;
}

/** 在指定格子上添加仓库建筑 */
function addWarehouse(
  env: ReturnType<typeof createTestEnv>,
  cell: { x: number; y: number },
) {
  const warehouse = createBuilding({
    defId: 'warehouse_shed',
    cell,
    mapId: env.map.id,
    defs: env.defs,
  });
  env.map.objects.add(warehouse);
  return warehouse;
}

// ── Eat Evaluator ──

describe('eatWorkEvaluator', () => {
  it('returns available with createJob when hungry and food exists', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    pawn.needs.food = 20;
    pawn.needsProfile.hungerSeekThreshold = 50;
    env.map.objects.add(createItem({ defId: 'meal_simple', cell: { x: 6, y: 5 }, mapId: env.map.id, stackCount: 2, defs: env.defs }));

    const result = eatWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('none');
    expect(result.createJob).not.toBeNull();
    expect(result.score).toBeGreaterThan(0);
    expect(result.kind).toBe('eat');
    expect(result.label).toBe('吃饭');
  });

  it('returns blocked need_not_triggered when not hungry', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    pawn.needs.food = 80;
    pawn.needsProfile.hungerSeekThreshold = 50;

    const result = eatWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('need_not_triggered');
    expect(result.createJob).toBeNull();
  });

  it('returns blocked no_target when no food exists', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    pawn.needs.food = 20;
    pawn.needsProfile.hungerSeekThreshold = 50;

    const result = eatWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('no_target');
    expect(result.createJob).toBeNull();
  });

  it('returns blocked target_reserved when all food is reserved', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    pawn.needs.food = 20;
    pawn.needsProfile.hungerSeekThreshold = 50;
    const meal = createItem({ defId: 'meal_simple', cell: { x: 6, y: 5 }, mapId: env.map.id, stackCount: 2, defs: env.defs });
    env.map.objects.add(meal);
    env.map.reservations.tryReserve({ claimantId: 'other', targetId: meal.id, jobId: 'job_other', currentTick: 0 });

    const result = eatWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('target_reserved');
    expect(result.createJob).toBeNull();
  });
});

// ── Sleep Evaluator ──

describe('sleepWorkEvaluator', () => {
  it('returns available with createJob when tired', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    pawn.needs.rest = 10;
    pawn.needsProfile.sleepSeekThreshold = 30;

    const result = sleepWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('none');
    expect(result.createJob).not.toBeNull();
    expect(result.kind).toBe('sleep');
    expect(result.label).toBe('睡觉');
  });

  it('returns blocked need_not_triggered when not tired', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    pawn.needs.rest = 80;
    pawn.needsProfile.sleepSeekThreshold = 30;

    const result = sleepWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('need_not_triggered');
    expect(result.createJob).toBeNull();
  });

  it('allows a normal pawn to seek sleep during its sleep window even if rest is above the old threshold', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env, { name: 'Normal' });
    setClockHour(env, 23);
    pawn.needs.rest = 60;
    pawn.needsProfile.sleepSeekThreshold = 35;

    const result = sleepWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('none');
    expect(result.createJob).not.toBeNull();
    expect(result.score).toBeGreaterThan(0);
  });

  it('gives a normal pawn higher sleep score than a night_owl at the same late hour', () => {
    const env = createTestEnv();
    setClockHour(env, 23);
    const normal = createTestPawn(env, { name: 'Normal' });
    const owl = createPawn({
      name: 'Owl',
      cell: { x: 7, y: 5 },
      mapId: env.map.id,
      factionId: 'player',
      rng: env.world.rng,
      traitIds: ['night_owl'],
    });
    env.map.objects.add(owl);

    normal.needs.rest = 45;
    owl.needs.rest = 45;

    const normalResult = sleepWorkEvaluator.evaluate(normal, env.map, env.world);
    const owlResult = sleepWorkEvaluator.evaluate(owl, env.map, env.world);

    expect(normalResult.failureReasonCode).toBe('none');
    expect(owlResult.failureReasonCode).toBe('none');
    expect(normalResult.score).toBeGreaterThan(owlResult.score);
  });

  it('gives a high_energy pawn lower sleep score than a normal pawn at the same night hour', () => {
    const env = createTestEnv();
    setClockHour(env, 23);
    const normal = createTestPawn(env, { name: 'Normal' });
    const energetic = createPawn({
      name: 'Energetic',
      cell: { x: 8, y: 5 },
      mapId: env.map.id,
      factionId: 'player',
      rng: env.world.rng,
      traitIds: ['high_energy'],
    });
    env.map.objects.add(energetic);

    normal.needs.rest = 45;
    energetic.needs.rest = 45;

    const normalResult = sleepWorkEvaluator.evaluate(normal, env.map, env.world);
    const energeticResult = sleepWorkEvaluator.evaluate(energetic, env.map, env.world);

    expect(normalResult.failureReasonCode).toBe('none');
    expect(energeticResult.failureReasonCode).toBe('none');
    expect(normalResult.score).toBeGreaterThan(energeticResult.score);
  });
});

// ── Wander Evaluator ──

describe('wanderWorkEvaluator', () => {
  it('returns blocked need_not_triggered when idleTicks <= 30', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    pawn.ai.idleTicks = 10;

    const result = wanderWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('need_not_triggered');
    expect(result.failureReasonText).toBe('空闲时间不足');
    expect(result.createJob).toBeNull();
    expect(result.kind).toBe('wander');
  });

  it('returns available with createJob when idleTicks > 30', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    pawn.ai.idleTicks = 31;

    const result = wanderWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('none');
    expect(result.createJob).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ── Haul To Storage Evaluator ──

describe('haulToStorageWorkEvaluator', () => {
  it('returns haul_to_storage when haulable item and warehouse both exist', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    env.map.objects.add(createItem({ defId: 'wood', cell: { x: 3, y: 5 }, mapId: env.map.id, stackCount: 5, defs: env.defs }));
    addWarehouse(env, { x: 10, y: 5 });

    const result = haulToStorageWorkEvaluator.evaluate(pawn, env.map, env.world);

    expect(result.kind).toBe('haul_to_storage');
    expect(result.failureReasonCode).toBe('none');
    expect(result.jobDefId).toBe('job_store_in_storage');
    expect(result.createJob).not.toBeNull();
    expect(result.label).toBe('搬运入库');
  });

  it('returns no_target when no haulable items', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    addWarehouse(env, { x: 10, y: 5 });

    const result = haulToStorageWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('no_target');
    expect(result.createJob).toBeNull();
  });

  it('returns no_target when items exist but no warehouse', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    env.map.objects.add(createItem({ defId: 'wood', cell: { x: 3, y: 5 }, mapId: env.map.id, stackCount: 5, defs: env.defs }));

    const result = haulToStorageWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('no_target');
    expect(result.createJob).toBeNull();
  });

  it('returns no_storage_destination when warehouse is full', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    env.map.objects.add(createItem({ defId: 'wood', cell: { x: 3, y: 5 }, mapId: env.map.id, stackCount: 5, defs: env.defs }));
    const warehouse = addWarehouse(env, { x: 10, y: 5 });
    warehouse.storage!.storedCount = warehouse.storage!.capacityMax;
    warehouse.storage!.inventory = { wood: warehouse.storage!.capacityMax };

    const result = haulToStorageWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('no_storage_destination');
    expect(result.createJob).toBeNull();
  });
});

// ── Construct Evaluator ──

describe('constructWorkEvaluator', () => {
  it('returns blocked no_target when no construction targets exist', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);

    const result = constructWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('no_target');
    expect(result.createJob).toBeNull();
    expect(result.kind).toBe('construct');
    expect(result.label).toBe('施工');
  });
});
