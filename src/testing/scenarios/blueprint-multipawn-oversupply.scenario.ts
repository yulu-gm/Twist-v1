import {
  createAssertStep,
  createScenario,
} from '../scenario-dsl/scenario.builders';
import { spawnItemFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import { placeBlueprintCommand } from '../scenario-commands/player-commands';
import {
  assertBuildingExists,
  waitForBuildingCreated,
} from '../scenario-probes/building-probes';
import { assertPawnNotCarrying } from '../scenario-probes/pawn-probes';

const BUILDER_A = 'Builder-A';
const BUILDER_B = 'Builder-B';
const BLUEPRINT_CELL = { x: 12, y: 10 } as const;
const SOURCE_A_CELL = { x: 7, y: 9 } as const;
const SOURCE_B_CELL = { x: 7, y: 11 } as const;

export const blueprintMultiPawnOversupplyScenario = createScenario({
  id: 'blueprint-multipawn-oversupply',
  title: '多 pawn 多料堆下的蓝图在途材料',
  description: '验证两个 builder 面对两个独立木头堆和同一个 wall 蓝图时，会把已经在路上的材料计入需求，避免第二名 builder 再去搬一整批多余木头。',
  report: {
    focus: '关注墙建成后是否仍保留一整堆未动用的源木头，以及蓝图附近是否没有散落多余木头，以证明第二名 builder 没有重复接送材单。',
  },
  setup: [
    spawnPawnFixture({ x: 9, y: 9 }, BUILDER_A),
    spawnPawnFixture({ x: 9, y: 11 }, BUILDER_B),
    spawnItemFixture('wood', SOURCE_A_CELL, 5),
    spawnItemFixture('wood', SOURCE_B_CELL, 5),
  ],
  script: [
    placeBlueprintCommand('wall_wood', BLUEPRINT_CELL),
    waitForBuildingCreated('等待 wall 建成', 'wall_wood', BLUEPRINT_CELL, 600),
  ],
  expect: [
    assertBuildingExists('wall_wood', BLUEPRINT_CELL),
    assertPawnNotCarrying(BUILDER_A),
    assertPawnNotCarrying(BUILDER_B),
    createAssertStep('应保留一整堆未动用的源木头', ({ query }) => {
      const sourceACount = query.findItemAt('wood', SOURCE_A_CELL)?.stackCount ?? 0;
      const sourceBCount = query.findItemAt('wood', SOURCE_B_CELL)?.stackCount ?? 0;
      const untouchedStacks = [sourceACount, sourceBCount].filter(count => count === 5).length;
      const emptiedStacks = [sourceACount, sourceBCount].filter(count => count === 0).length;
      return untouchedStacks === 1 && emptiedStacks === 1;
    }, {
      failureMessage: '两个源木堆都被消费了，说明第二名 builder 也去搬了多余材料',
    }),
    createAssertStep('蓝图附近不应散落多余木头', ({ query }) => {
      return !query.findItemsByDef('wood').some(item =>
        Math.abs(item.cell.x - BLUEPRINT_CELL.x) <= 2
        && Math.abs(item.cell.y - BLUEPRINT_CELL.y) <= 2);
    }, {
      failureMessage: '蓝图附近仍有多余木头散落，说明发生了重复送材后的落地',
    }),
    createAssertStep('木头总量守恒且仅消耗 5 个', ({ query }) => {
      return query.totalMaterialCountInWorld('wood') === 10;
    }, {
      failureMessage: '木头总量不守恒，无法确认在途材料计算是否正确',
    }),
  ],
});
