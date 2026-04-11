import {
  createAssertStep,
  createScenario,
  createWaitForStep,
} from '../scenario-dsl/scenario.builders';
import { spawnItemFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import { placeBlueprintCommand } from '../scenario-commands/player-commands';
import {
  assertBuildingExists,
  waitForBuildingCreated,
} from '../scenario-probes/building-probes';
import { assertPawnNotCarrying } from '../scenario-probes/pawn-probes';

const BUILDER_NAME = 'Builder';
const SOURCE_CELL = { x: 8, y: 10 } as const;
const BLUEPRINT_CELL = { x: 12, y: 10 } as const;

export const blueprintOversupplyHaulScenario = createScenario({
  id: 'blueprint-oversupply-haul',
  title: '大堆材料下的蓝图定量搬运',
  description: '验证当地图上只有一大堆木头时，wall 蓝图仍只会搬运所需的 5 个木头，而不会超量搬运并把余料落在蓝图格。',
  report: {
    focus: '关注 builder 的携带数量、源木堆剩余数量，以及蓝图格是否出现多余木头落地。',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, BUILDER_NAME),
    spawnItemFixture('wood', SOURCE_CELL, 20),
  ],
  script: [
    placeBlueprintCommand('wall_wood', BLUEPRINT_CELL),
    createWaitForStep('等待 builder 只携带 wall 所需的 5 木头', ({ query }) => {
      const pawn = query.findPawnByName(BUILDER_NAME);
      const sourceStack = query.findItemAt('wood', SOURCE_CELL);
      return pawn?.inventory.carrying?.defId === 'wood'
        && pawn.inventory.carrying.count === 5
        && sourceStack?.stackCount === 15;
    }, {
      timeoutTicks: 200,
      timeoutMessage: 'builder 没有表现出“只拿 5 木头、源堆剩 15”的定量搬运行为',
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
      failureMessage: '蓝图格残留了多余木头，疑似发生超量搬运后落地',
    }),
    createAssertStep('木头总量守恒且建筑仅消耗 5 个', ({ query }) => {
      return query.totalMaterialCountInWorld('wood') === 20;
    }, {
      failureMessage: '木头总量不守恒，无法说明是定量搬运还是超量落地',
    }),
  ],
});
