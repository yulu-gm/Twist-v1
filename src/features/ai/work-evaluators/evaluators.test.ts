/**
 * @file evaluators.test.ts
 * @description 工作评估器单元测试 — 直接测试各 evaluator 的 evaluate() 方法
 * @part-of AI 子系统（features/ai）
 */

import { describe, expect, it } from 'vitest';
import { ZoneType, cellKey } from '../../../core/types';
import { buildDefDatabase } from '../../../defs';
import { createGameMap } from '../../../world/game-map';
import { createWorld } from '../../../world/world';
import { createItem } from '../../item/item.factory';
import { createPawn } from '../../pawn/pawn.factory';
import { eatWorkEvaluator, sleepWorkEvaluator } from './needs.evaluator';
import { wanderWorkEvaluator } from './wander.evaluator';
import { haulToStockpileWorkEvaluator } from './hauling.evaluator';
import { constructWorkEvaluator } from './construction.evaluator';

/** 创建标准测试环境 */
function createTestEnv() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 42 });
  const map = createGameMap({ id: 'main', width: 20, height: 20 });
  world.maps.set(map.id, map);
  return { defs, world, map };
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

/** 在指定格子上添加单格存储区 */
function addStockpile(map: ReturnType<typeof createGameMap>, cell: { x: number; y: number }) {
  map.zones.add({
    id: `zone_stockpile_${cellKey(cell)}`,
    zoneType: ZoneType.Stockpile,
    cells: new Set([cellKey(cell)]),
    config: { stockpile: { allowAllHaulable: true, allowedDefIds: new Set() } },
  });
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
    expect(result.label).toBe('Eat');
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
    expect(result.label).toBe('Sleep');
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
});

// ── Wander Evaluator ──

describe('wanderWorkEvaluator', () => {
  it('returns blocked need_not_triggered when idleTicks <= 30', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    pawn.ai.idleTicks = 10;

    const result = wanderWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('need_not_triggered');
    expect(result.failureReasonText).toBe('Not idle long enough');
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

// ── Haul To Stockpile Evaluator ──

describe('haulToStockpileWorkEvaluator', () => {
  it('returns available when haulable item and stockpile exist', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    env.map.objects.add(createItem({ defId: 'wood', cell: { x: 3, y: 5 }, mapId: env.map.id, stackCount: 5, defs: env.defs }));
    addStockpile(env.map, { x: 10, y: 5 });

    const result = haulToStockpileWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('none');
    expect(result.createJob).not.toBeNull();
    expect(result.kind).toBe('haul_to_stockpile');
    expect(result.label).toBe('Haul To Stockpile');
  });

  it('returns blocked no_target when no haulable items', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    addStockpile(env.map, { x: 10, y: 5 });

    const result = haulToStockpileWorkEvaluator.evaluate(pawn, env.map, env.world);
    expect(result.failureReasonCode).toBe('no_target');
    expect(result.createJob).toBeNull();
  });

  it('returns blocked no_target when items exist but no stockpile', () => {
    const env = createTestEnv();
    const pawn = createTestPawn(env);
    env.map.objects.add(createItem({ defId: 'wood', cell: { x: 3, y: 5 }, mapId: env.map.id, stackCount: 5, defs: env.defs }));

    const result = haulToStockpileWorkEvaluator.evaluate(pawn, env.map, env.world);
    // 无存储区时搬运路径不成立，评估器将其视为 no_target
    expect(result.failureReasonCode).toBe('no_target');
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
    expect(result.label).toBe('Construct');
  });
});
