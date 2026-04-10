/**
 * @file zone-stockpile-lifecycle.scenario.ts
 * @description Stockpile 区域生命周期长剧本 — 验证 zone 创建、扩展、局部移除后，
 *              AI 仍能持续把木材送入有效格，被移除格子不再接收新物品。
 * @part-of testing/scenarios — 业务场景库
 */

import { createScenario, createWaitForStep } from '../scenario-dsl/scenario.builders';
import { spawnItemFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import { createZoneCommand, removeZoneCellsCommand } from '../scenario-commands/zone-commands';
import { assertNoItemAt, assertTotalItemCountInCells, waitForItemAt } from '../scenario-probes/item-probes';

/**
 * Stockpile 区域生命周期
 *
 * 验证链路：
 * 1. 创建初始 stockpile（2 格）
 * 2. 等待第一批木材进入
 * 3. 扩展 stockpile（包含一个已有格作为锚点 + 2 个新格）
 * 4. 等待所有木材搬入
 * 5. 移除初始格之一
 * 6. 验证总量正确、源地清空
 */
export const zoneStockpileLifecycleScenario = createScenario({
  id: 'zone-stockpile-lifecycle',
  title: 'Stockpile 区域生命周期',
  description: '验证 zone 创建、扩展、局部移除后，AI 仍能持续把木材送入有效格',
  report: {
    focus: '关注 zone 变化后，搬运目标格是否仍然合法且被移除的格子不再接收新物品',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, 'Hauler'),
    spawnItemFixture('wood', { x: 6, y: 10 }, 4),
    spawnItemFixture('wood', { x: 6, y: 12 }, 3),
    spawnItemFixture('wood', { x: 6, y: 14 }, 2),
  ],
  script: [
    // 阶段 1：创建初始 2 格 stockpile，等待第一批木材搬入
    createZoneCommand('stockpile', [{ x: 16, y: 10 }, { x: 17, y: 10 }]),
    waitForItemAt('等待第一批木材进入 stockpile', 'wood', { x: 16, y: 10 }, 300),

    // 阶段 2：扩展 stockpile — 包含已有格 (17,10) 作为锚点以确保合并到同一 zone
    createZoneCommand('stockpile', [{ x: 17, y: 10 }, { x: 18, y: 10 }, { x: 18, y: 11 }]),

    // 等待全部 9 个木材搬入任意 stockpile 格
    createWaitForStep('等待全部木材搬入 stockpile', ({ query }) => {
      return query.totalItemCountInCells('wood', [
        { x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }, { x: 18, y: 11 },
      ]) >= 9;
    }, { timeoutTicks: 600, timeoutMessage: '木材未全部搬入 stockpile' }),

    // 阶段 3：移除旧格 (16,10)
    removeZoneCellsCommand([{ x: 16, y: 10 }]),
  ],
  expect: [
    // 验证总量守恒 — 所有 4 格（含已移除的）中的木材总数为 9
    assertTotalItemCountInCells('wood', [
      { x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }, { x: 18, y: 11 },
    ], 9),
    // 验证源地已清空
    assertNoItemAt('wood', { x: 6, y: 10 }),
    assertNoItemAt('wood', { x: 6, y: 12 }),
    assertNoItemAt('wood', { x: 6, y: 14 }),
  ],
});
