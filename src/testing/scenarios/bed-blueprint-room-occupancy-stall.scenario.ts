import {
  createAssertStep,
  createScenario,
  createSetupStep,
  createWaitForStep,
} from '../scenario-dsl/scenario.builders';
import { ObjectKind } from '@core/types';
import { createBuilding } from '@features/building/building.factory';
import {
  spawnItemFixture,
  spawnPawnFixture,
} from '../scenario-fixtures/world-fixtures';
import { placeBlueprintCommand } from '../scenario-commands/player-commands';
import { assertBuildingExists } from '../scenario-probes/building-probes';

const BUILDER_NAME = 'Bob';
const INSIDE_PAWN_NAMES = ['Alice', 'Charlie'] as const;

const BED_CELL = { x: 12, y: 10 } as const;

const BUILDER_START = { x: 16, y: 10 } as const;
const WOOD_CELL = { x: 18, y: 10 } as const;

const ALICE_START = { x: 11, y: 10 } as const;
const CHARLIE_START = { x: 13, y: 11 } as const;

const ROOM_WALL_CELLS = [
  { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 }, { x: 13, y: 8 }, { x: 14, y: 8 },
  { x: 10, y: 9 },
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
  { x: 10, y: 13 }, { x: 11, y: 13 }, { x: 12, y: 13 }, { x: 13, y: 13 }, { x: 14, y: 13 },
  { x: 14, y: 9 },
  { x: 14, y: 11 },
  { x: 14, y: 12 },
] as const;

let builderEnteredFootprint = false;
let sawDeliverJob = false;
let sawConstructJob = false;
let sawConstructionSite = false;

export const bedBlueprintRoomOccupancyStallScenario = createScenario({
  id: 'bed-blueprint-room-adjacent-build',
  title: '单出口房间内床位应邻格建造',
  description: '验证有出入口的房间里放置 bed_wood 后，builder 会从 footprint 外邻格送材和施工，而不是踩到多格蓝图本体上。',
  report: {
    focus: '关注 Bob 的邻格站位：送材和施工期间都应停在床 footprint 外侧，同时床仍应顺利从蓝图 promote 到最终建筑。',
  },
  setup: [
    createSetupStep('重置邻格建造记录', () => {
      builderEnteredFootprint = false;
      sawDeliverJob = false;
      sawConstructJob = false;
      sawConstructionSite = false;
    }),
    createSetupStep('搭建一个带单出口的木墙房间', ({ harness }) => {
      for (const cell of ROOM_WALL_CELLS) {
        const wall = createBuilding({
          defId: 'wall_wood',
          cell,
          mapId: harness.map.id,
          defs: harness.world.defs,
        });
        harness.map.objects.add(wall);
      }
      harness.map.pathGrid.rebuildFrom(harness.map, harness.world.defs);
    }),
    spawnPawnFixture(BUILDER_START, BUILDER_NAME),
    spawnPawnFixture(ALICE_START, INSIDE_PAWN_NAMES[0]),
    spawnPawnFixture(CHARLIE_START, INSIDE_PAWN_NAMES[1]),
    createSetupStep('固定房间内 pawn 站位，避免它们自己走开', ({ harness }) => {
      for (const name of INSIDE_PAWN_NAMES) {
        const pawn = harness.map.objects
          .allOfKind(ObjectKind.Pawn)
          .find((candidate: any) => candidate.name === name) as any;
        if (!pawn) {
          throw new Error(`Pawn "${name}" not found`);
        }
        pawn.drafted = true;
      }
    }),
    spawnItemFixture('wood', WOOD_CELL, 8),
  ],
  script: [
    placeBlueprintCommand('bed_wood', BED_CELL),
    createWaitForStep('等待 Bob 从邻格完成 bed 的送材与施工', ({ query }) => {
      const bob = query.findPawnByName(BUILDER_NAME) as any;
      const site = query.findConstructionSiteAt('bed_wood', BED_CELL);
      const bed = query.findBuildingAt('bed_wood', BED_CELL);

      if (bob) {
        if (bob.cell.x === BED_CELL.x && (bob.cell.y === BED_CELL.y || bob.cell.y === BED_CELL.y + 1)) {
          builderEnteredFootprint = true;
        }
        if (bob.ai.currentJob?.defId === 'job_deliver_materials') {
          sawDeliverJob = true;
        }
        if (bob.ai.currentJob?.defId === 'job_construct') {
          sawConstructJob = true;
        }
      }

      if (site) {
        sawConstructionSite = true;
      }

      return bed !== null;
    }, {
      timeoutTicks: 500,
      timeoutMessage: 'Bob 没有在预期时间内从邻格完成单出口房间内的 bed 建造',
    }),
  ],
  expect: [
    assertBuildingExists('bed_wood', BED_CELL),
    createAssertStep('Bob 在送材和施工期间都不应踏入 bed footprint', () => {
      return builderEnteredFootprint === false;
    }, {
      failureMessage: '记录到 Bob 踩进了 1x2 bed 蓝图 footprint，未满足邻格建造约束',
    }),
    createAssertStep('Bob 应实际执行过送材工作', () => {
      return sawDeliverJob;
    }, {
      failureMessage: '没有观察到 Bob 执行 job_deliver_materials',
    }),
    createAssertStep('Bob 应实际执行过施工工作', () => {
      return sawConstructJob;
    }, {
      failureMessage: '没有观察到 Bob 执行 job_construct',
    }),
    createAssertStep('bed 蓝图应 promote 为 construction site 再完成', () => {
      return sawConstructionSite;
    }, {
      failureMessage: '没有观察到 bed 从 blueprint promote 为 construction site 的中间状态',
    }),
  ],
});
