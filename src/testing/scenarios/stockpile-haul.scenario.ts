/**
 * @file stockpile-haul.scenario.ts
 * @description 搬运进 Stockpile 场景 — 验证 stockpile 创建 → AI 搬运 → 物品放置 完整链路
 * @part-of testing/scenarios — 业务场景库
 */

import { createScenario } from '../scenario-dsl/scenario.builders';
import { spawnPawnAction, spawnItemAction, createStockpileAction } from '../scenario-actions/setup-actions';
import { waitForItemInStockpileAction, assertItemStackAtAction } from '../scenario-actions/wait-conditions';

/**
 * 搬运进 Stockpile 场景
 *
 * 验证链路：
 * 1. 创建 stockpile 区域
 * 2. 生成地面物品（木材）
 * 3. pawn 自动接到搬运工作
 * 4. pawn 移动到物品位置并拾取
 * 5. pawn 前往 stockpile 并放置
 * 6. 物品出现在 stockpile 内
 */
export const stockpileHaulScenario = createScenario({
  id: 'stockpile-haul',
  title: '搬运进 Stockpile',
  description: '验证物品搬运全流程：stockpile 创建 → AI 识别未存储物品 → 搬运 → 放置',
  report: {
    focus: '关注 pawn 是否自动发现未入库物品并搬运到 stockpile 区域',
  },
  setup: [
    spawnPawnAction({ x: 10, y: 10 }, 'Hauler'),
    spawnItemAction('wood', { x: 6, y: 10 }, 5),
    createStockpileAction([{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }]),
  ],
  script: [
    waitForItemInStockpileAction('等待木材进入 stockpile', 'wood', { x: 16, y: 10 }, 300),
  ],
  expect: [
    assertItemStackAtAction('wood', { x: 16, y: 10 }, 1),
  ],
});
