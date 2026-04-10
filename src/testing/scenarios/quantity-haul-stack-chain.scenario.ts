/**
 * @file quantity-haul-stack-chain.scenario.ts
 * @description 数量搬运与堆叠链路长剧本 — 验证多堆木材在入库后总量守恒、
 *              源地清空，并在 stockpile 中形成合理堆叠。
 *              断言聚焦总量守恒和源地清空，不强制指定落点。
 * @part-of testing/scenarios — 业务场景库
 */

import { createScenario, createWaitForStep } from '../scenario-dsl/scenario.builders';
import { spawnItemFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import { createZoneCommand } from '../scenario-commands/zone-commands';
import {
  assertAnyItemStackAtLeast,
  assertNoItemAt,
  assertTotalItemCountInCells,
} from '../scenario-probes/item-probes';

/**
 * 数量搬运与堆叠链路
 *
 * 验证链路：
 * 1. 创建 3 格 stockpile
 * 2. 三堆不同数量的木材（3 + 5 + 7 = 15）被搬入
 * 3. 验证总量守恒（15）
 * 4. 验证至少有一个合理堆叠
 * 5. 验证源地全部清空
 */
export const quantityHaulStackChainScenario = createScenario({
  id: 'quantity-haul-stack-chain',
  title: '数量搬运与堆叠链路',
  description: '验证多堆木材在入库后总量守恒、源地清空，并在 stockpile 中形成合理堆叠',
  report: {
    focus: '关注 pickup、deliver、drop 之后的最终总量与堆叠结果，而不是固定落点',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, 'Hauler'),
    spawnItemFixture('wood', { x: 4, y: 10 }, 3),
    spawnItemFixture('wood', { x: 5, y: 10 }, 5),
    spawnItemFixture('wood', { x: 6, y: 10 }, 7),
  ],
  script: [
    createZoneCommand('stockpile', [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }]),
    // 等待所有 15 个木材搬入 stockpile（不指定具体落点）
    createWaitForStep('等待所有木材搬入 stockpile', ({ query }) => {
      return query.totalItemCountInCells('wood', [
        { x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 },
      ]) >= 15;
    }, { timeoutTicks: 800, timeoutMessage: '木材未全部搬入 stockpile' }),
  ],
  expect: [
    assertTotalItemCountInCells('wood', [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }], 15),
    assertAnyItemStackAtLeast('wood', [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }], 3),
    assertNoItemAt('wood', { x: 4, y: 10 }),
    assertNoItemAt('wood', { x: 5, y: 10 }),
    assertNoItemAt('wood', { x: 6, y: 10 }),
  ],
});
