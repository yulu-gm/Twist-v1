/**
 * @file eating.scenario.ts
 * @description 进食场景 — 验证 needs 触发 → AI 选择进食 → 拾取食物 → 消费恢复 完整链路
 * @part-of testing/scenarios — 业务场景库
 */

import { createScenario } from '../scenario-dsl/scenario.builders';
import { spawnPawnAction, spawnItemAction, setPawnFoodByNameAction } from '../scenario-actions/setup-actions';
import {
  waitForPawnJobDefAction,
  waitForPawnFoodAtLeastAction,
  assertPawnFoodAtLeastAction,
} from '../scenario-actions/wait-conditions';

/**
 * 进食场景
 *
 * 验证链路：
 * 1. 设置 pawn 为饥饿状态（food < 30）
 * 2. 地图上有可食物品
 * 3. pawn 自动选择进食工作
 * 4. pawn 移动到食物位置并拾取
 * 5. pawn 等待进食完成
 * 6. 饱食度恢复
 */
export const eatingScenario = createScenario({
  id: 'eating',
  title: '进食',
  description: '验证进食全流程：饥饿 → AI 寻找食物 → 拾取 → 进食 → 饱食度恢复',
  report: {
    focus: '关注 pawn 是否在饱食度低于阈值时自动寻找并消费食物',
  },
  setup: [
    spawnPawnAction({ x: 10, y: 10 }, 'Eater'),
    spawnItemAction('meal_simple', { x: 12, y: 10 }, 4),
    setPawnFoodByNameAction('Eater', 5),
  ],
  script: [
    waitForPawnJobDefAction('等待 pawn 切到进食工作', 'Eater', 'job_eat', 100),
    waitForPawnFoodAtLeastAction('等待饱食度恢复', 'Eater', 30, 300),
  ],
  expect: [
    assertPawnFoodAtLeastAction('Eater', 30),
  ],
});
