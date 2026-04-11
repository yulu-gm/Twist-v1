/**
 * @file job-selector.work-reasons.test.ts
 * @description 工作决策 blocked 原因测试 — 验证 construct/deliver_materials/resolve_carrying 的 blocked 原因
 * @part-of AI 子系统（features/ai）
 */

import { describe, expect, it } from 'vitest';
import { ZoneType, cellKey } from '../../core/types';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createItem } from '../item/item.factory';
import { createPawn } from '../pawn/pawn.factory';
import { placeBlueprintHandler } from '../construction/construction.commands';
import { jobSelectionSystem } from './job-selector';

describe('job selector work reasons', () => {
  it('marks construct blocked when a blueprint is not fully delivered and activates deliver_materials', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 2, y: 2 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    map.objects.add(pawn);

    placeBlueprintHandler.execute(world, {
      type: 'place_blueprint',
      payload: { defId: 'wall_wood', cell: { x: 8, y: 2 }, mapId: map.id },
    } as any);

    map.objects.add(createItem({
      defId: 'wood',
      cell: { x: 4, y: 2 },
      mapId: map.id,
      stackCount: 10,
      defs,
    }));

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_deliver_materials');
    expect(pawn.ai.workDecision?.options.find(option => option.kind === 'construct'))
      .toMatchObject({ status: 'blocked', failureReasonCode: 'materials_not_delivered' });
    expect(pawn.ai.workDecision?.options.find(option => option.kind === 'deliver_materials'))
      .toMatchObject({ status: 'active' });
  });

  it('marks pickup-based work blocked by carrying conflict and activates resolve_carrying', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 12345 });
    const map = createGameMap({ id: 'main', width: 16, height: 16 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    pawn.inventory.carrying = { defId: 'wood', count: 12 };
    pawn.needs.food = 10;
    pawn.needsProfile.hungerSeekThreshold = 50;
    map.objects.add(pawn);

    map.objects.add(createItem({
      defId: 'meal_simple',
      cell: { x: 2, y: 1 },
      mapId: map.id,
      stackCount: 1,
      defs,
    }));

    map.zones.add({
      id: 'zone_stockpile',
      zoneType: ZoneType.Stockpile,
      cells: new Set([cellKey({ x: 5, y: 1 })]),
      config: { stockpile: { allowAllHaulable: true, allowedDefIds: new Set() } },
    });

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toMatch(/^job_(carry|store_carried_materials|deliver_carried_materials)$/);
    expect(pawn.ai.workDecision?.options.find(option => option.kind === 'eat'))
      .toMatchObject({ status: 'blocked', failureReasonCode: 'carrying_conflict' });
    expect(pawn.ai.workDecision?.options.find(option => option.kind === 'resolve_carrying'))
      .toMatchObject({ status: 'active' });
  });
});
