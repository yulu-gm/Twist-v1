import {
  createAssertStep,
  createScenario,
  createSetupStep,
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

const BUILDER_A = 'Builder-A';
const BUILDER_B = 'Builder-B';
const BLUEPRINT_CELL = { x: 12, y: 10 } as const;
const WAREHOUSE_CELL = { x: 7, y: 10 } as const;
const PRESTOCKED_WOOD = 10;
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

export const blueprintMultiPawnOversupplyScenario = createScenario({
  id: 'blueprint-multipawn-oversupply',
  title: '多 pawn 共享仓库下的蓝图在途材料',
  description:
    '验证两个 builder 面对单个仓库和同一个 wall 蓝图时，会把已经在路上的材料计入需求，避免第二名 builder 也去仓库重复取一份多余木头。',
  report: {
    focus: '关注墙建成后仓库剩余木头是否仍为 5（仅被取走 5 个），以及蓝图附近是否没有散落多余木头。',
  },
  setup: [
    spawnPawnFixture({ x: 9, y: 9 }, BUILDER_A),
    spawnPawnFixture({ x: 9, y: 11 }, BUILDER_B),
    spawnBuildingFixture('warehouse_shed', WAREHOUSE_CELL),
    createSetupStep('预先填充仓库 10 木头', ({ harness }) => {
      const warehouse = findWarehouseFromHarness(harness);
      if (warehouse?.storage) {
        warehouse.storage.inventory.wood = PRESTOCKED_WOOD;
        warehouse.storage.storedCount = PRESTOCKED_WOOD;
      }
    }),
  ],
  script: [
    placeBlueprintCommand('wall_wood', BLUEPRINT_CELL),
    waitForBuildingCreated('等待 wall 建成', 'wall_wood', BLUEPRINT_CELL, 800),
  ],
  expect: [
    assertBuildingExists('wall_wood', BLUEPRINT_CELL),
    assertPawnNotCarrying(BUILDER_A),
    assertPawnNotCarrying(BUILDER_B),
    createAssertStep('仓库应剩余一半木头（在途材料计算正确）', ({ query }) => {
      const warehouse = findWarehouseFromQuery(query);
      const remaining = warehouse?.storage?.inventory?.wood ?? 0;
      return remaining === PRESTOCKED_WOOD - WALL_WOOD_COST;
    }, {
      failureMessage:
        '仓库剩余木头不为 5，说明第二名 builder 去仓库重复取了多余材料',
    }),
    createAssertStep('蓝图附近不应散落多余木头', ({ query }) => {
      return !query.findItemsByDef('wood').some(item =>
        Math.abs(item.cell.x - BLUEPRINT_CELL.x) <= 2
        && Math.abs(item.cell.y - BLUEPRINT_CELL.y) <= 2);
    }, {
      failureMessage: '蓝图附近仍有多余木头散落，说明发生了重复取材后的落地',
    }),
  ],
});
