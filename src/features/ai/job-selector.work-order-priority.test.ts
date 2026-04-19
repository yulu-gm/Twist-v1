/**
 * @file job-selector.work-order-priority.test.ts
 * @description 工作订单优先级测试 — 验证 evaluator 严格按订单 priorityIndex 取活，
 *              高优先订单总是先被选中（即使距离更远），并把 claimed 状态写回订单 item
 * @part-of AI 子系统（features/ai）
 */

import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPawn } from '../pawn/pawn.factory';
import { createPlant } from '../plant/plant.factory';
import { jobSelectionSystem } from './job-selector';
import { createMapWorkOrderHandler } from '../work-orders/work-order.commands';

describe('job selector work order priority', () => {
  it('selects the higher-priority cut order before a lower-priority one despite distance', () => {
    const defs = buildDefDatabase();
    const world = createWorld({ defs, seed: 1 });
    const map = createGameMap({ id: 'main', width: 20, height: 20 });
    world.maps.set(map.id, map);

    const pawn = createPawn({
      name: 'Alice',
      cell: { x: 1, y: 1 },
      mapId: map.id,
      factionId: 'player',
      rng: world.rng,
    });
    map.objects.add(pawn);

    // 近树：低优先订单 / 远树：高优先订单
    const farTree = createPlant({ defId: 'tree_oak', cell: { x: 18, y: 18 }, mapId: map.id, defs, growthProgress: 1 });
    const nearTree = createPlant({ defId: 'tree_oak', cell: { x: 3, y: 1 }, mapId: map.id, defs, growthProgress: 1 });
    map.objects.add(farTree);
    map.objects.add(nearTree);

    // 高优先订单（priorityIndex=0）覆盖远树
    const highCmd = {
      type: 'create_map_work_order',
      payload: {
        mapId: map.id,
        orderKind: 'cut',
        title: '高优先砍树',
        priorityIndex: 0,
        items: [{ targetRef: { kind: 'object', objectId: farTree.id } }],
      },
    };
    const highValid = createMapWorkOrderHandler.validate(world, highCmd as any);
    expect(highValid.valid).toBe(true);
    createMapWorkOrderHandler.execute(world, highCmd as any);

    // 低优先订单（priorityIndex=1）覆盖近树
    const lowCmd = {
      type: 'create_map_work_order',
      payload: {
        mapId: map.id,
        orderKind: 'cut',
        title: '低优先砍树',
        priorityIndex: 1,
        items: [{ targetRef: { kind: 'object', objectId: nearTree.id } }],
      },
    };
    createMapWorkOrderHandler.execute(world, lowCmd as any);

    jobSelectionSystem.execute(world);

    // 期望：分配的工作目标是 远树 对应的 designation（属于高优先订单）
    const orders = map.workOrders.list();
    const high = orders[0];
    const low = orders[1];
    expect(high.title).toBe('高优先砍树');
    expect(low.title).toBe('低优先砍树');

    // 高优先订单的 item 已被领取
    expect(high.items[0].status).toBe('claimed');
    expect(high.items[0].claimedByPawnId).toBe(pawn.id);
    expect(high.items[0].artifactId).toBeDefined();

    // 低优先订单仍处于 open
    expect(low.items[0].status).toBe('open');

    // pawn 的当前工作携带订单回链，且目标 cell 为远树
    expect(pawn.ai.currentJob).not.toBeNull();
    expect(pawn.ai.currentJob?.workOrderId).toBe(high.id);
    expect(pawn.ai.currentJob?.workOrderItemId).toBe(high.items[0].id);
  });
});
