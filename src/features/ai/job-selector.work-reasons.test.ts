/**
 * @file job-selector.work-reasons.test.ts
 * @description 工作决策 blocked 原因测试 — 验证 construct/deliver_materials/resolve_carrying 的 blocked 原因
 * @part-of AI 子系统（features/ai）
 */

import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createBuilding } from '../building/building.factory';
import { createItem } from '../item/item.factory';
import { createPawn } from '../pawn/pawn.factory';
import { createMapWorkOrderHandler } from '../work-orders/work-order.commands';
import { jobSelectionSystem } from './job-selector';
import { deliverMaterialsWorkEvaluator } from './work-evaluators/construction.evaluator';

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

    // 通过 build 工作订单创建蓝图（evaluator 现在只接受订单派生的 artifact）
    createMapWorkOrderHandler.execute(world, {
      type: 'create_map_work_order',
      payload: {
        mapId: map.id,
        orderKind: 'build',
        title: '建墙',
        items: [{ targetRef: { kind: 'cell', cell: { x: 8, y: 2 }, defId: 'wall_wood' } }],
      },
    } as any);

    // 仓库里已经存好了木材——deliver_materials 应该从仓库取材
    const warehouse = createBuilding({
      defId: 'warehouse_shed',
      cell: { x: 4, y: 6 },
      mapId: map.id,
      defs,
    });
    warehouse.storage!.inventory = { wood: 10 };
    warehouse.storage!.storedCount = 10;
    map.objects.add(warehouse);

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toBe('job_take_from_storage');
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

    // 仓库提供 carrying 的合法落地目标（替代旧的 stockpile zone）
    const warehouse = createBuilding({
      defId: 'warehouse_shed',
      cell: { x: 5, y: 1 },
      mapId: map.id,
      defs,
    });
    map.objects.add(warehouse);

    jobSelectionSystem.execute(world);

    expect(pawn.ai.currentJob?.defId).toMatch(/^job_(carry|store_carried_materials|deliver_carried_materials)$/);
    expect(pawn.ai.workDecision?.options.find(option => option.kind === 'eat'))
      .toMatchObject({ status: 'blocked', failureReasonCode: 'carrying_conflict' });
    expect(pawn.ai.workDecision?.options.find(option => option.kind === 'resolve_carrying'))
      .toMatchObject({ status: 'active' });
  });

  it('blocks deliver_materials when material only exists on the ground', () => {
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

    // 通过 build 工作订单创建蓝图
    createMapWorkOrderHandler.execute(world, {
      type: 'create_map_work_order',
      payload: {
        mapId: map.id,
        orderKind: 'build',
        title: '建墙',
        items: [{ targetRef: { kind: 'cell', cell: { x: 14, y: 10 }, defId: 'wall_wood' } }],
      },
    } as any);

    // 地面有大量木材，但没有任何仓库
    map.objects.add(createItem({
      defId: 'wood',
      cell: { x: 8, y: 10 },
      mapId: map.id,
      stackCount: 20,
      defs,
    }));

    const result = deliverMaterialsWorkEvaluator.evaluate(pawn, map, world);

    expect(result.failureReasonCode).toBe('no_storage_source');
    expect(result.createJob).toBeNull();
  });
});
