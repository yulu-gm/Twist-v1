/**
 * @file blueprint-construction.scenario.ts
 * @description 建造蓝图场景 — 验证 蓝图放置 → 材料搬运 → 施工 → 建筑完成 完整链路
 * @part-of testing/scenarios — 业务场景库
 */

import { createScenario } from '../scenario-dsl/scenario.builders';
import { spawnPawnAction, spawnItemAction } from '../scenario-actions/setup-actions';
import { placeBlueprintAction } from '../scenario-actions/player-actions';
import {
  waitForBlueprintDeliveredAction,
  waitForBuildingCreatedAction,
  assertBuildingExistsAction,
} from '../scenario-actions/wait-conditions';

/**
 * 建造蓝图场景
 *
 * 验证链路：
 * 1. 放置建筑蓝图（wall_wood）
 * 2. 地图上有足够的木材
 * 3. pawn 自动搬运材料到蓝图
 * 4. 材料送达后蓝图转为工地
 * 5. pawn 在工地施工
 * 6. 施工完成后工地转为建筑
 */
export const blueprintConstructionScenario = createScenario({
  id: 'blueprint-construction',
  title: '建造蓝图',
  description: '验证建造全流程：蓝图放置 → 材料搬运 → 施工 → 建筑落地',
  report: {
    focus: '关注蓝图的材料交付进度和工地的施工进度',
  },
  setup: [
    spawnPawnAction({ x: 10, y: 10 }, 'Builder'),
    spawnItemAction('wood', { x: 8, y: 10 }, 20),
    placeBlueprintAction('wall_wood', { x: 14, y: 10 }),
  ],
  script: [
    waitForBlueprintDeliveredAction('等待材料送达蓝图', 'wall_wood', 300),
    waitForBuildingCreatedAction('等待建筑完成', 'wall_wood', { x: 14, y: 10 }, 600),
  ],
  expect: [
    assertBuildingExistsAction('wall_wood', { x: 14, y: 10 }),
  ],
});
