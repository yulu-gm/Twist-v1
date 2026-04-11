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
import {
  assertPawnNotCarrying,
  waitForPawnCarrying,
} from '../scenario-probes/pawn-probes';

const BUILDER_NAME = 'Builder';
const BLUEPRINT_CELL = { x: 12, y: 10 } as const;

export const blueprintSelfOccupancyPromoteScenario = createScenario({
  id: 'blueprint-self-occupancy-promote',
  title: '蓝图自占位 promote 观察',
  description: '验证最后一趟送材的 pawn 自己站在目标格时，蓝图是否仍能成功 promote 为工地并完成建造。',
  report: {
    focus: '关注 builder 到达蓝图格后，目标格是否会在 builder 仍占位时出现 construction site，而不是停在已交付蓝图状态。',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, BUILDER_NAME),
    spawnItemFixture('wood', { x: 8, y: 10 }, 5),
  ],
  script: [
    placeBlueprintCommand('wall_wood', BLUEPRINT_CELL),
    waitForPawnCarrying('等待 builder 搬起木材', BUILDER_NAME, 'wood', 5, 200),
    createWaitForStep('等待 builder 站在目标格时蓝图已 promote 为工地', ({ query }) => {
      const pawn = query.findPawnByName(BUILDER_NAME);
      const site = query.findConstructionSiteAt('wall_wood', BLUEPRINT_CELL);
      return pawn?.cell.x === BLUEPRINT_CELL.x
        && pawn.cell.y === BLUEPRINT_CELL.y
        && site !== null;
    }, {
      timeoutTicks: 300,
      timeoutMessage: 'builder 到达目标格后，没有观察到蓝图在其自占位状态下 promote 为工地',
    }),
    waitForBuildingCreated('等待最终墙体建成', 'wall_wood', BLUEPRINT_CELL, 600),
  ],
  expect: [
    assertBuildingExists('wall_wood', BLUEPRINT_CELL),
    assertPawnNotCarrying(BUILDER_NAME),
    createAssertStep('目标格不应残留 wall_wood 蓝图', ({ query }) => {
      return query.findBlueprintsByTargetDef('wall_wood').length === 0;
    }, {
      failureMessage: '场景结束时仍残留 wall_wood 蓝图',
    }),
  ],
});
