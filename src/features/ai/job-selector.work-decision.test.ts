/**
 * @file job-selector.work-decision.test.ts
 * @description 工作决策快照测试 — 验证 selector 冻结有序决策快照并标记 active/deferred/blocked 状态
 * @part-of AI 子系统（features/ai）
 */

import { describe, expect, it } from 'vitest';
import { ZoneType, cellKey } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createItem } from '../item/item.factory';
import { createPawn } from '../pawn/pawn.factory';
import { jobSelectionSystem } from './job-selector';

/** 在指定格子上添加单格存储区 */
function addStockpile(map: ReturnType<typeof createGameMap>, cell: { x: number; y: number }) {
  map.zones.add({
    id: 'zone_stockpile',
    zoneType: ZoneType.Stockpile,
    cells: new Set([cellKey(cell)]),
    config: { stockpile: { allowAllHaulable: true, allowedDefIds: new Set() } },
  });
}

describe('job selector work decision snapshot', () => {
  it('freezes ranked work options and marks the selected option active', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 20;
    pawn.needsProfile.hungerSeekThreshold = 50;
    map.objects.add(pawn);

    map.objects.add(createItem({
      defId: 'meal_simple',
      cell: { x: 2, y: 1 },
      mapId: map.id,
      stackCount: 2,
      defs,
    }));

    map.objects.add(createItem({
      defId: 'wood',
      cell: { x: 4, y: 1 },
      mapId: map.id,
      stackCount: 10,
      defs,
    }));
    addStockpile(map, { x: 8, y: 1 });

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_eat');
    expect(pawn.ai.workDecision?.selectedWorkKind).toBe('eat');
    expect(pawn.ai.workDecision?.options[0]).toMatchObject({
      kind: 'eat',
      status: 'active',
    });
    expect(pawn.ai.workDecision?.options.some(option => (
      option.kind === 'haul_to_stockpile' && option.status === 'deferred'
    ))).toBe(true);
  });

  it('records a blocked higher-priority option when reservation fails and falls through', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 12, height: 12 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.needs.food = 20;
    pawn.needsProfile.hungerSeekThreshold = 50;
    map.objects.add(pawn);

    const meal = createItem({
      defId: 'meal_simple',
      cell: { x: 2, y: 1 },
      mapId: map.id,
      stackCount: 2,
      defs,
    });
    map.objects.add(meal);
    map.reservations.tryReserve({
      claimantId: 'other_pawn',
      targetId: meal.id,
      jobId: 'job_other',
      currentTick: world.tick,
    });

    map.objects.add(createItem({
      defId: 'wood',
      cell: { x: 4, y: 1 },
      mapId: map.id,
      stackCount: 10,
      defs,
    }));
    addStockpile(map, { x: 8, y: 1 });

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_haul');
    expect(pawn.ai.workDecision?.options[0]).toMatchObject({
      kind: 'eat',
      status: 'blocked',
      failureReasonCode: 'target_reserved',
    });
    expect(pawn.ai.workDecision?.options.some(option => (
      option.kind === 'haul_to_stockpile' && option.status === 'active'
    ))).toBe(true);
  });
});
