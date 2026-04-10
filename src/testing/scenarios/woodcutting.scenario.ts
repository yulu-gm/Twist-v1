/**
 * @file woodcutting.scenario.ts
 * @description 砍树场景 — 验证 command → designation → AI → work → 物品掉落 完整链路
 * @part-of testing/scenarios — 业务场景库
 */

import { createScenario } from '../scenario-dsl/scenario.builders';
import { spawnPawnFixture, placeTreeFixture } from '../scenario-fixtures/world-fixtures';
import { designateCutCommand } from '../scenario-commands/player-commands';
import { waitForPawnAnyJob } from '../scenario-probes/pawn-probes';
import { waitForNoPlantAt, assertWoodDropped } from '../scenario-probes/item-probes';

/**
 * 砍树场景
 *
 * 验证链路：
 * 1. 下达砍树指令
 * 2. designation 成功生成
 * 3. pawn 接到工作
 * 4. pawn 移动到目标
 * 5. work 完成
 * 6. 树被移除
 * 7. 生成木材
 */
export const woodcuttingScenario = createScenario({
  id: 'woodcutting',
  title: '砍树',
  description: '验证砍树全流程：指派 → AI 接单 → 移动 → 工作 → 树倒 → 木材掉落',
  report: {
    focus: '关注树上的 cut designation、pawn 是否接单并靠近树',
  },
  setup: [
    placeTreeFixture({ x: 12, y: 12 }, 'tree_oak'),
    spawnPawnFixture({ x: 10, y: 12 }, 'Cutter'),
  ],
  script: [
    designateCutCommand({ x: 12, y: 12 }),
    waitForPawnAnyJob('等待 pawn 接到砍树工作', 'Cutter', 50),
    waitForNoPlantAt('等待树被砍倒', { x: 12, y: 12 }, 300),
  ],
  expect: [
    assertWoodDropped({ x: 12, y: 12 }),
  ],
});
