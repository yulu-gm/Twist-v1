import {
  createScenario,
  createWaitForStep,
} from '../scenario-dsl/scenario.builders';
import { spawnItemFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import {
  draftPawnCommand,
  forceGotoCommand,
  placeBlueprintCommand,
} from '../scenario-commands/player-commands';
import {
  assertBuildingExists,
  waitForBuildingCreated,
} from '../scenario-probes/building-probes';
import { assertPawnNotCarrying, waitForPawnCarrying } from '../scenario-probes/pawn-probes';

const BUILDER_NAME = 'Builder';
const BLOCKER_NAME = 'Blocker';
const BLUEPRINT_CELL = { x: 12, y: 10 } as const;
const BLOCKED_FOOTPRINT_CELL = { x: 12, y: 11 } as const;
const BUILDER_EXIT_CELL = { x: 16, y: 10 } as const;
const BLOCKER_EXIT_CELL = { x: 16, y: 11 } as const;

export const blueprintBlockedPromoteRetryScenario = createScenario({
  id: 'blueprint-blocked-promote-retry',
  title: '临时占位后的蓝图 promote 恢复',
  description: '验证 bed 蓝图在最终送材瞬间被另一名 pawn 占住 footprint 后，即使所有 pawn 后续都离开 footprint，也能否及时恢复 promote 与施工。',
  report: {
    focus: '关注 fully delivered 的 bed 蓝图在 footprint 临时被挡住后，builder 和 blocker 都离开 footprint 时能否很快从 blueprint 进入 construction site，而不是继续卡住。',
  },
  setup: [
    spawnPawnFixture({ x: 10, y: 10 }, BUILDER_NAME),
    spawnPawnFixture({ x: 15, y: 11 }, BLOCKER_NAME),
    spawnItemFixture('wood', { x: 8, y: 10 }, 8),
  ],
  script: [
    placeBlueprintCommand('bed_wood', BLUEPRINT_CELL),
    forceGotoCommand(BLOCKER_NAME, BLOCKED_FOOTPRINT_CELL),
    createWaitForStep('等待 blocker 占住 bed footprint 的第二格', ({ query }) => {
      const blocker = query.findPawnByName(BLOCKER_NAME);
      return blocker?.cell.x === BLOCKED_FOOTPRINT_CELL.x
        && blocker.cell.y === BLOCKED_FOOTPRINT_CELL.y;
    }, {
      timeoutTicks: 200,
      timeoutMessage: 'blocker 没有及时站到 bed blueprint 的第二格',
    }),
    draftPawnCommand(BLOCKER_NAME),
    waitForPawnCarrying('等待 builder 搬起整份 bed 材料', BUILDER_NAME, 'wood', 8, 200),
    createWaitForStep('等待 bed 蓝图材料送齐但仍停留为 blueprint', ({ query }) => {
      const blueprint = query.findBlueprintsByTargetDef('bed_wood')
        .find((bp: any) => bp.cell.x === BLUEPRINT_CELL.x && bp.cell.y === BLUEPRINT_CELL.y) as any;
      const builder = query.findPawnByName(BUILDER_NAME);
      const site = query.findConstructionSiteAt('bed_wood', BLUEPRINT_CELL);
      return !!blueprint
        && blueprint.materialsDelivered?.[0]?.count === 8
        && site === null
        && builder?.cell.x === BLUEPRINT_CELL.x
        && builder.cell.y === BLUEPRINT_CELL.y;
    }, {
      timeoutTicks: 300,
      timeoutMessage: '没有观察到“材料送齐但因 footprint 被挡仍停留为 blueprint”的状态',
    }),
    forceGotoCommand(BUILDER_NAME, BUILDER_EXIT_CELL),
    forceGotoCommand(BLOCKER_NAME, BLOCKER_EXIT_CELL),
    createWaitForStep('等待 builder 和 blocker 都离开 bed footprint', ({ query }) => {
      const builder = query.findPawnByName(BUILDER_NAME);
      const blocker = query.findPawnByName(BLOCKER_NAME);
      return !!builder
        && !!blocker
        && !(builder.cell.x === BLUEPRINT_CELL.x && builder.cell.y === BLUEPRINT_CELL.y)
        && !(builder.cell.x === BLOCKED_FOOTPRINT_CELL.x && builder.cell.y === BLOCKED_FOOTPRINT_CELL.y)
        && !(blocker.cell.x === BLOCKED_FOOTPRINT_CELL.x && blocker.cell.y === BLOCKED_FOOTPRINT_CELL.y)
        && !(blocker.cell.x === BLUEPRINT_CELL.x && blocker.cell.y === BLUEPRINT_CELL.y);
    }, {
      timeoutTicks: 200,
      timeoutMessage: 'builder 和 blocker 没有及时都离开 bed blueprint footprint',
    }),
    createWaitForStep('等待 fully delivered 的 bed 蓝图在 footprint 清空后及时 promote', ({ query }) => {
      return query.findConstructionSiteAt('bed_wood', BLUEPRINT_CELL) !== null;
    }, {
      timeoutTicks: 20,
      timeoutMessage: 'footprint 清空后，fully delivered 的 bed 蓝图没有及时 promote 为 construction site',
    }),
    waitForBuildingCreated('等待最终 bed 建成', 'bed_wood', BLUEPRINT_CELL, 400),
  ],
  expect: [
    assertBuildingExists('bed_wood', BLUEPRINT_CELL),
    assertPawnNotCarrying(BUILDER_NAME),
  ],
});
