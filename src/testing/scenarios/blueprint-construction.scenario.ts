/**
 * @file blueprint-construction.scenario.ts
 * @description 仓库供料建造场景 — 验证 地面物资入仓 → 蓝图放置 → 仓库取材 → 施工 → 建筑完成 完整链路
 * @part-of testing/scenarios — 业务场景库
 */

import { createScenario, createWaitForStep, createAssertStep } from '../scenario-dsl/scenario.builders';
import { spawnPawnFixture, spawnItemFixture, spawnBuildingFixture } from '../scenario-fixtures/world-fixtures';
import { placeBlueprintCommand } from '../scenario-commands/player-commands';
import { waitForBlueprintDelivered, waitForBuildingCreated, assertBuildingExists } from '../scenario-probes/building-probes';

/**
 * 建造蓝图场景（仓库供料版）
 *
 * 验证链路：
 * 1. 地面有木材 + 仓库 building 已就位
 * 2. pawn 把地面木材搬入仓库（仓库抽象库存增加）
 * 3. 放置建筑蓝图（wall_wood）
 * 4. pawn 从仓库取材并送达蓝图
 * 5. 材料送达后蓝图升级为工地，pawn 开始施工
 * 6. 施工完成后工地转为建筑
 */
export const blueprintConstructionScenario = createScenario({
  id: 'blueprint-construction',
  title: '仓库供料建造',
  description: '验证仓库存储建造全流程：地面物资入仓 → 蓝图放置 → 仓库取材送达 → 施工 → 建筑落地',
  report: {
    focus: '关注木材何时进入仓库，以及蓝图材料是否完全来自仓库取材',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, 'Builder'),
    spawnItemFixture('wood', { x: 8, y: 10 }, 20),
    spawnBuildingFixture('warehouse_shed', { x: 12, y: 8 }),
  ],
  script: [
    createWaitForStep('等待木材进入仓库', ({ query }) => {
      const warehouse = query.findBuildingAt('warehouse_shed', { x: 12, y: 8 }) as any;
      return (warehouse?.storage?.inventory?.wood ?? 0) >= 5;
    }, { timeoutTicks: 300, timeoutMessage: '木材未先进入仓库' }),
    placeBlueprintCommand('wall_wood', { x: 14, y: 10 }),
    waitForBlueprintDelivered('等待仓库材料送达蓝图', 'wall_wood', 600),
    waitForBuildingCreated('等待建筑完成', 'wall_wood', { x: 14, y: 10 }, 900),
  ],
  expect: [
    assertBuildingExists('wall_wood', { x: 14, y: 10 }),
    createAssertStep('施工阶段没有残留地面木材', ({ query }) => query.findItemsByDef('wood').length === 0, {
      failureMessage: '施工期间出现了未入仓的地面木材来源',
    }),
  ],
});
