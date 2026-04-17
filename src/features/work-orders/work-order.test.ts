/**
 * @file work-order.test.ts
 * @description 工作订单（WorkOrder）领域单元测试 — 覆盖订单创建、状态命令（暂停/恢复/取消）、
 *              重排序、维护系统的目标失效检测与终态推进等核心行为。
 * @dependencies vitest — 测试框架；buildDefDatabase, createWorld, createGameMap — 测试 harness；
 *               registerDefaultCommands — 命令注册；reconcileWorkOrders — 维护系统纯函数
 * @part-of features/work-orders — 工作订单功能
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { registerDefaultCommands } from '../../bootstrap/default-registrations';
import { reconcileWorkOrders } from './work-order.system';

/** 创建测试用世界，包含已注册命令的单地图环境 */
function createTestWorld() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 42 });
  const map = createGameMap({ id: 'main', width: 10, height: 10 });
  world.maps.set(map.id, map);
  registerDefaultCommands(world);
  return { world, map };
}

describe('create_map_work_order', () => {
  it('creates one map order with two open items and preserves list order', () => {
    const { world, map } = createTestWorld();

    world.commandQueue.push({
      type: 'create_map_work_order',
      payload: {
        mapId: map.id,
        orderKind: 'mine',
        title: '测试挖矿订单',
        items: [
          { targetRef: { kind: 'cell', cell: { x: 1, y: 1 } } },
          { targetRef: { kind: 'cell', cell: { x: 2, y: 2 } } },
        ],
      },
    });

    world.commandBus.processQueue(world);

    const orders = map.workOrders.list();
    expect(orders).toHaveLength(1);

    const order = orders[0];
    expect(order.sourceKind).toBe('map');
    expect(order.orderKind).toBe('mine');
    expect(order.title).toBe('测试挖矿订单');
    expect(order.status).toBe('pending');
    expect(order.priorityIndex).toBe(0);
    expect(order.items).toHaveLength(2);
    expect(order.items[0].status).toBe('open');
    expect(order.items[1].status).toBe('open');
    expect(order.items[0].targetRef).toEqual({ kind: 'cell', cell: { x: 1, y: 1 } });
    expect(order.items[1].targetRef).toEqual({ kind: 'cell', cell: { x: 2, y: 2 } });

    // 确认事件发出
    const evt = world.eventBuffer.find(e => e.type === 'work_order_created');
    expect(evt).toBeDefined();
    expect(evt!.data).toMatchObject({
      orderId: order.id,
      sourceKind: 'map',
      orderKind: 'mine',
      itemCount: 2,
    });
  });
});

describe('pause / resume / cancel commands', () => {
  it('pauses, resumes and cancels orders through explicit commands', () => {
    const { world, map } = createTestWorld();

    // 直接通过 store 创建一个结果订单
    const order = map.workOrders.createResultOrder({
      orderKind: 'craft',
      title: '产出订单',
      items: [{ targetRef: { kind: 'result_batch', batchId: 'batch_1' } }],
      createdAtTick: world.tick,
    });

    // 暂停
    world.commandQueue.push({
      type: 'pause_work_order',
      payload: { mapId: map.id, orderId: order.id },
    });
    world.commandBus.processQueue(world);
    expect(order.status).toBe('paused');
    expect(world.eventBuffer.some(e => e.type === 'work_order_paused')).toBe(true);

    // 恢复 — 应回到 pending（active 由 item 推进决定）
    world.commandQueue.push({
      type: 'resume_work_order',
      payload: { mapId: map.id, orderId: order.id },
    });
    world.commandBus.processQueue(world);
    expect(order.status).toBe('pending');
    expect(world.eventBuffer.some(e => e.type === 'work_order_resumed')).toBe(true);

    // 取消
    world.commandQueue.push({
      type: 'cancel_work_order',
      payload: { mapId: map.id, orderId: order.id },
    });
    world.commandBus.processQueue(world);
    expect(order.status).toBe('cancelled');
    expect(world.eventBuffer.some(e => e.type === 'work_order_cancelled')).toBe(true);
  });
});

describe('reconcileWorkOrders', () => {
  it('reconciles invalid items and marks order done when all items terminate', () => {
    const { world, map } = createTestWorld();

    // 创建一个目标对象不存在的 item
    const order = map.workOrders.createMapOrder({
      orderKind: 'haul',
      title: '失效目标订单',
      items: [{ targetRef: { kind: 'object', objectId: 'obj_does_not_exist' } }],
      createdAtTick: world.tick,
    });

    expect(order.status).toBe('pending');

    reconcileWorkOrders(world);

    expect(order.items[0].status).toBe('invalid');
    expect(order.items[0].blockedReason).toBe('target_missing');
    expect(order.status).toBe('done');
  });

  it('marks fully open result orders as blocked with no_executor and keeps order pending', () => {
    const { world, map } = createTestWorld();

    // 结果订单：无人认领时（全部 open），reconcile 应将 item 标为 blocked
    const order = map.workOrders.createResultOrder({
      orderKind: 'craft',
      title: '无执行者订单',
      items: [{ targetRef: { kind: 'result_batch', batchId: 'batch_a' } }],
      createdAtTick: world.tick,
    });

    expect(order.items[0].status).toBe('open');

    reconcileWorkOrders(world);

    // item 被标为 blocked + no_executor
    expect(order.items[0].status).toBe('blocked');
    expect(order.items[0].blockedReason).toBe('no_executor');
    // blocked 非终态 → 订单不是 done
    expect(order.status).not.toBe('done');
    // hasInProgress 仅看 claimed/working，blocked item 留下订单为 pending
    expect(order.status).toBe('pending');
  });
});

describe('reorder_work_orders', () => {
  it('reassigns priorityIndex correctly and appends missing orders preserving relative order', () => {
    const { world, map } = createTestWorld();

    const a = map.workOrders.createMapOrder({
      orderKind: 'mine', title: 'A', items: [], createdAtTick: world.tick,
    });
    const b = map.workOrders.createMapOrder({
      orderKind: 'mine', title: 'B', items: [], createdAtTick: world.tick,
    });
    const c = map.workOrders.createMapOrder({
      orderKind: 'mine', title: 'C', items: [], createdAtTick: world.tick,
    });

    // 初始顺序 A=0, B=1, C=2
    expect(a.priorityIndex).toBe(0);
    expect(b.priorityIndex).toBe(1);
    expect(c.priorityIndex).toBe(2);

    // 仅传入 [C, A]，B 应被追加在末尾保持原相对顺序
    world.commandQueue.push({
      type: 'reorder_work_orders',
      payload: { mapId: map.id, orderIds: [c.id, a.id] },
    });
    world.commandBus.processQueue(world);

    expect(c.priorityIndex).toBe(0);
    expect(a.priorityIndex).toBe(1);
    expect(b.priorityIndex).toBe(2);

    // list() 应按 priorityIndex 升序返回
    const sorted = map.workOrders.list();
    expect(sorted.map(o => o.id)).toEqual([c.id, a.id, b.id]);
  });
});

describe('cancel_work_order side effects on items', () => {
  it('flips active items to invalid with order_cancelled reason and order to cancelled', () => {
    const { world, map } = createTestWorld();

    const order = map.workOrders.createMapOrder({
      orderKind: 'haul',
      title: '取消订单',
      items: [
        { targetRef: { kind: 'cell', cell: { x: 0, y: 0 } } },
        { targetRef: { kind: 'cell', cell: { x: 1, y: 0 } }, status: 'claimed', claimedByPawnId: 'p1' },
      ],
      createdAtTick: world.tick,
    });

    // 第二项已被领取
    expect(order.items[1].status).toBe('claimed');

    world.commandQueue.push({
      type: 'cancel_work_order',
      payload: { mapId: map.id, orderId: order.id },
    });
    world.commandBus.processQueue(world);

    expect(order.status).toBe('cancelled');
    for (const it of order.items) {
      expect(it.status).toBe('invalid');
      expect(it.blockedReason).toBe('order_cancelled');
    }
  });
});

describe('assign_preferred_pawn', () => {
  let setup: ReturnType<typeof createTestWorld>;
  beforeEach(() => { setup = createTestWorld(); });

  it('adds and removes preferred pawns', () => {
    const { world, map } = setup;
    const order = map.workOrders.createMapOrder({
      orderKind: 'mine', title: 't', items: [], createdAtTick: world.tick,
    });

    world.commandQueue.push({
      type: 'assign_preferred_pawn',
      payload: { mapId: map.id, orderId: order.id, pawnId: 'pawn_1' },
    });
    world.commandBus.processQueue(world);
    expect(order.preferredPawnIds).toEqual(['pawn_1']);

    // 重复添加不增重
    world.commandQueue.push({
      type: 'assign_preferred_pawn',
      payload: { mapId: map.id, orderId: order.id, pawnId: 'pawn_1' },
    });
    world.commandBus.processQueue(world);
    expect(order.preferredPawnIds).toEqual(['pawn_1']);

    // 移除
    world.commandQueue.push({
      type: 'assign_preferred_pawn',
      payload: { mapId: map.id, orderId: order.id, pawnId: 'pawn_1', mode: 'remove' },
    });
    world.commandBus.processQueue(world);
    expect(order.preferredPawnIds).toEqual([]);
  });
});
