/**
 * @file work-order-map-priority.scenario.ts
 * @description 工作订单优先级场景 — 验证单个 pawn 在面临多张地图来源订单时，
 *              会优先消费 priorityIndex 较小的高优先级订单，即便低优先级目标更近。
 *              这是 Task 6 引入的 work order 系统首条专项回归。
 * @part-of testing/scenarios — 业务场景库
 */

import { createScenario } from '../scenario-dsl/scenario.builders';
import { createAssertStep } from '../scenario-dsl/scenario.builders';
import { placeTreeFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import { createCutOrderCommand } from '../scenario-commands/player-commands';
import { waitForNoPlantAt } from '../scenario-probes/item-probes';

/**
 * 工作订单优先级场景
 *
 * 布局：
 * - 远树 (6,6)：被高优先订单（priorityIndex=0）覆盖
 * - 近树 (2,2)：被低优先订单（priorityIndex=1）覆盖
 * - Pawn 出生在 (0,2)，曼哈顿距离：→近树=2，→远树=10
 *
 * 期望：pawn 先去远树（高优先），等远树倒下时近树仍未被砍。
 */
export const workOrderMapPriorityScenario = createScenario({
  id: 'work-order-map-priority',
  title: '工作订单优先级',
  description: '验证 pawn 优先消费高优先级订单（远树先于近树被砍）',
  report: {
    focus: '关注两棵树的砍伐顺序与订单优先级是否匹配',
  },
  setup: [
    // 高优先目标（更远）
    placeTreeFixture({ x: 6, y: 6 }, 'tree_oak'),
    // 低优先目标（更近）
    placeTreeFixture({ x: 2, y: 2 }, 'tree_oak'),
    // Pawn 距离低优先树更近，用以确认排序压过距离启发
    spawnPawnFixture({ x: 0, y: 2 }, 'Cutter'),
  ],
  script: [
    createCutOrderCommand('高优先砍树', [{ x: 6, y: 6 }], 0),
    createCutOrderCommand('低优先砍树', [{ x: 2, y: 2 }], 1),
    waitForNoPlantAt('等待远树（高优先）被砍倒', { x: 6, y: 6 }, 600),
    // 远树刚倒的瞬间：低优先的近树必须仍然存在
    createAssertStep('高优先订单先完成（近树仍在）', ({ query }) =>
      query.findPlantAt({ x: 2, y: 2 }) !== null,
      { failureMessage: '近树已被砍倒，说明高优先订单未先于低优先订单执行' },
    ),
  ],
  expect: [],
});
