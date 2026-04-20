import {
  createAssertStep,
  createScenario,
  createSetupStep,
  createWaitForStep,
} from '../scenario-dsl/scenario.builders';
import { ObjectKind } from '@core/types';
import { spawnBuildingFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import { placeBlueprintCommand } from '../scenario-commands/player-commands';
import {
  assertBuildingExists,
  waitForBuildingCreated,
} from '../scenario-probes/building-probes';
import { assertPawnNotCarrying } from '../scenario-probes/pawn-probes';
import type { ScenarioQueryApi } from '../scenario-dsl/scenario.types';

const BUILDER_NAME = 'Builder';
const WAREHOUSE_CELL = { x: 8, y: 10 } as const;
const WAREHOUSE_ALIAS = 'warehouse';
const BLUEPRINT_CELL = { x: 12, y: 10 } as const;
const PRESTOCKED_WOOD = 20;
const WALL_WOOD_COST = 5;

function findWarehouseFromHarness(harness: any) {
  const all = harness.map.objects.allOfKind(ObjectKind.Building) as any[];
  return all.find(
    (b: any) =>
      b.defId === 'warehouse_shed'
      && b.cell.x === WAREHOUSE_CELL.x
      && b.cell.y === WAREHOUSE_CELL.y,
  );
}

function findWarehouseFromQuery(query: ScenarioQueryApi) {
  return query.findBuildingAt('warehouse_shed', WAREHOUSE_CELL) as any;
}

export const blueprintOversupplyHaulScenario = createScenario({
  id: 'blueprint-oversupply-haul',
  title: '仓库定量取材建造',
  description:
    '验证 wall 蓝图只会从仓库取出所需的 5 个木头，不会把仓库整堆 20 木头都搬到蓝图侧。',
  report: {
    focus: '关注 builder 携带数量、仓库剩余存量，以及蓝图格是否出现多余木头落地。',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, BUILDER_NAME),
    spawnBuildingFixture('warehouse_shed', WAREHOUSE_CELL, { alias: WAREHOUSE_ALIAS }),
    createSetupStep('预先填充仓库 20 木头', ({ harness }) => {
      const warehouse = findWarehouseFromHarness(harness);
      if (warehouse?.storage) {
        warehouse.storage.inventory.wood = PRESTOCKED_WOOD;
        warehouse.storage.storedCount = PRESTOCKED_WOOD;
      }
    }),
  ],
  script: [
    placeBlueprintCommand('wall_wood', BLUEPRINT_CELL),
    createWaitForStep('等待 builder 只携带 wall 所需的 5 木头', ({ query }) => {
      const pawn = query.findPawnByName(BUILDER_NAME);
      return pawn?.inventory.carrying?.defId === 'wood'
        && pawn.inventory.carrying.count === WALL_WOOD_COST;
    }, {
      timeoutTicks: 400,
      timeoutMessage: 'builder 没有表现出"只取 5 木头"的定量取材行为',
    }),
    waitForBuildingCreated('等待 wall 建成', 'wall_wood', BLUEPRINT_CELL, 600),
  ],
  expect: [
    assertBuildingExists('wall_wood', BLUEPRINT_CELL),
    assertPawnNotCarrying(BUILDER_NAME),
    createAssertStep('蓝图格不应残留多余木头', ({ query }) => {
      const item = query.findItemAt('wood', BLUEPRINT_CELL);
      return item === null;
    }, {
      failureMessage: '蓝图格残留了多余木头，疑似发生超量取材后落地',
    }),
    createAssertStep('仓库应剩余 15 个木头（仅消耗了 5）', ({ query }) => {
      const warehouse = findWarehouseFromQuery(query);
      const remaining = warehouse?.storage?.inventory?.wood ?? 0;
      return remaining === PRESTOCKED_WOOD - WALL_WOOD_COST;
    }, {
      failureMessage: '仓库剩余木头数量不正确，定量取材未生效',
    }),
  ],
});
