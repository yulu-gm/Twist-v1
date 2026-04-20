/**
 * @file warehouse-storage-haul.scenario.ts
 * @description 仓库入库场景 — 验证地面物资被搬入仓库并转化为抽象库存的完整链路
 * @part-of testing/scenarios — 业务场景库
 */

import { createScenario, createWaitForStep, createAssertStep } from '../scenario-dsl/scenario.builders';
import { spawnPawnFixture, spawnItemFixture, spawnBuildingFixture } from '../scenario-fixtures/world-fixtures';

/**
 * 仓库入库场景
 *
 * 验证链路：
 * 1. 地面有 5 单位木材 + 一栋仓库
 * 2. pawn 自动接到 haul_to_storage 工作
 * 3. pawn 拾取木材 → 走到仓库交互格 → 写入抽象库存
 * 4. 地面木材清空，仓库 inventory.wood 恰为 5
 */
export const warehouseStorageHaulScenario = createScenario({
  id: 'warehouse-storage-haul',
  title: '搬运进入仓库',
  description: '验证地面物资会被搬到仓库并转成抽象库存。',
  report: {
    focus: '关注 pawn 是否走 haul_to_storage 路径，把地面木材入仓而不是落地。',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, 'Hauler'),
    spawnItemFixture('wood', { x: 6, y: 10 }, 5),
    spawnBuildingFixture('warehouse_shed', { x: 14, y: 8 }),
  ],
  script: [
    createWaitForStep('等待木材进入仓库', ({ query }) => {
      const warehouse = query.findBuildingAt('warehouse_shed', { x: 14, y: 8 }) as any;
      return (warehouse?.storage?.inventory?.wood ?? 0) === 5;
    }, { timeoutTicks: 400, timeoutMessage: '木材未进入仓库' }),
  ],
  expect: [
    createAssertStep('地面木材已清空', ({ query }) => query.findItemsByDef('wood').length === 0, {
      failureMessage: '地面仍残留木材',
    }),
    createAssertStep('仓库库存恰为 5 单位木材', ({ query }) => {
      const warehouse = query.findBuildingAt('warehouse_shed', { x: 14, y: 8 }) as any;
      return warehouse?.storage?.inventory?.wood === 5
        && warehouse?.storage?.storedCount === 5;
    }, { failureMessage: '仓库库存数量与预期不符' }),
  ],
});
