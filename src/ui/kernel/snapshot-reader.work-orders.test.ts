/**
 * @file snapshot-reader.work-orders.test.ts
 * @description 引擎快照工作订单投影测试 — 验证 WorkOrderStore 投影到 EngineSnapshot.workOrders 的语义
 *              （totalItemCount/doneItemCount/activeWorkerCount/blocked，以及 byId 与 list 引用一致）。
 * @dependencies vitest — 测试框架；buildDefDatabase, createWorld, createGameMap — 测试 harness；
 *               createPresentationState — 展示层默认状态；readEngineSnapshot — 被测函数
 * @part-of ui/kernel — UI 内核层
 */

import { describe, expect, it } from 'vitest';
import { buildDefDatabase } from '../../defs';
import { createGameMap } from '../../world/game-map';
import { createWorld } from '../../world/world';
import { createPresentationState } from '../../presentation/presentation-state';
import { readEngineSnapshot } from './snapshot-reader';

/** 创建包含单地图与默认展示层的测试环境 */
function setup() {
  const defs = buildDefDatabase();
  const world = createWorld({ defs, seed: 7 });
  const map = createGameMap({ id: 'main', width: 8, height: 8 });
  world.maps.set(map.id, map);
  const presentation = createPresentationState();
  return { world, map, presentation };
}

describe('readEngineSnapshot — work orders projection', () => {
  it('projects a result order with a single blocked item as blocked snapshot', () => {
    const { world, map, presentation } = setup();

    // 直接通过 store 创建结果订单，并预设其唯一 item 为 blocked（无执行者）
    const order = map.workOrders.createResultOrder({
      orderKind: 'craft',
      title: '产出订单A',
      items: [{
        targetRef: { kind: 'result_batch', batchId: 'batch_x' },
        status: 'blocked',
        blockedReason: 'no_executor',
      }],
      createdAtTick: world.tick,
    });

    const snapshot = readEngineSnapshot(world, map, presentation, { recentEvents: [] });

    expect(snapshot.workOrders.list).toHaveLength(1);
    const node = snapshot.workOrders.list[0];
    expect(node).toMatchObject({
      title: '产出订单A',
      sourceKind: 'result',
      blocked: true,
      totalItemCount: 1,
    });
    // byId 与 list 必须是同一对象引用（保证 Preact memo 等值比对）
    expect(snapshot.workOrders.byId[order.id]).toBe(node);

    // item 节点字段语义
    expect(node.items).toHaveLength(1);
    const item = node.items[0];
    expect(item.status).toBe('blocked');
    expect(item.blockedReason).toBe('no_executor');
    expect(item.claimedByPawnId).toBeNull();
  });

  it('counts a claimed item as one active worker and not blocked', () => {
    const { world, map, presentation } = setup();

    const order = map.workOrders.createMapOrder({
      orderKind: 'mine',
      title: '挖矿订单',
      items: [{
        targetRef: { kind: 'cell', cell: { x: 3, y: 3 } },
        status: 'claimed',
        claimedByPawnId: 'p1',
      }],
      createdAtTick: world.tick,
    });

    const snapshot = readEngineSnapshot(world, map, presentation, { recentEvents: [] });

    expect(snapshot.workOrders.list).toHaveLength(1);
    const node = snapshot.workOrders.byId[order.id];
    expect(node.activeWorkerCount).toBe(1);
    expect(node.blocked).toBe(false);
    expect(node.items[0].claimedByPawnId).toBe('p1');
  });
});
