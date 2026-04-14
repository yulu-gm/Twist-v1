import {
  createAssertStep,
  createScenario,
  createSetupStep,
  createWaitForStep,
} from '../scenario-dsl/scenario.builders';
import {
  setPawnRestFixture,
  spawnBuildingFixture,
  spawnPawnFixture,
} from '../scenario-fixtures/world-fixtures';

const PAWN_NAMES = ['Sleeper-A', 'Sleeper-B', 'Sleeper-C'] as const;
const RECOVERY_REST_THRESHOLD = 45;

const BED_CELLS = [
  { x: 12, y: 10 },
  { x: 15, y: 10 },
] as const;

let bedSleepers: string[] = [];
let floorSleepers: string[] = [];
let restoredSleepers: string[] = [];
let bedOwners: string[] = [];

export const sleepBedOccupancyScenario = createScenario({
  id: 'sleep-bed-occupancy',
  title: '三人两床的自动认床睡眠',
  description: '验证两名小人会在困倦时自动认领两张空床并入睡，第三名会因为无空床而睡地板。',
  report: {
    focus: '关注 sleep job 分配、空床 owner 自动认领、床位 occupant 写入、第三人 floor sleep，以及醒来后的 occupant 释放。',
  },
  setup: [
    createSetupStep('重置场景记录', () => {
      bedSleepers = [];
      floorSleepers = [];
      restoredSleepers = [];
      bedOwners = [];
    }),
    spawnPawnFixture({ x: 8, y: 10 }, 'Sleeper-A'),
    spawnPawnFixture({ x: 8, y: 12 }, 'Sleeper-B'),
    spawnPawnFixture({ x: 8, y: 14 }, 'Sleeper-C'),
    setPawnRestFixture('Sleeper-A', 10),
    setPawnRestFixture('Sleeper-B', 10),
    setPawnRestFixture('Sleeper-C', 10),
    spawnBuildingFixture('bed_wood', BED_CELLS[0]),
    spawnBuildingFixture('bed_wood', BED_CELLS[1]),
  ],
  script: [
    createWaitForStep('等待三人都切换到睡眠工作', ({ query }) => {
      const pawns = PAWN_NAMES.map(name => query.findPawnByName(name));
      if (pawns.some(pawn => pawn?.ai.currentJob?.defId !== 'job_sleep')) {
        return false;
      }

      const nextBedSleepers = pawns
        .filter((pawn): pawn is NonNullable<typeof pawn> => !!pawn?.ai.currentJob?.targetId)
        .map(pawn => pawn.name);
      const nextFloorSleepers = pawns
        .filter((pawn): pawn is NonNullable<typeof pawn> => !!pawn && !pawn.ai.currentJob?.targetId)
        .map(pawn => pawn.name);

      if (nextBedSleepers.length !== 2 || nextFloorSleepers.length !== 1) {
        return false;
      }

      bedSleepers = nextBedSleepers;
      floorSleepers = nextFloorSleepers;
      return true;
    }, {
      timeoutTicks: 80,
      timeoutMessage: '三名小人没有按预期形成“两床一地板”的睡眠分配',
    }),
    createWaitForStep('等待两张床被不同小人自动认领 owner', ({ query }) => {
      const bedA = query.findBuildingAt('bed_wood', BED_CELLS[0]) as any;
      const bedB = query.findBuildingAt('bed_wood', BED_CELLS[1]) as any;
      const owners = [bedA?.bed?.ownerPawnId, bedB?.bed?.ownerPawnId].filter((owner): owner is string => !!owner);
      const uniqueOwners = new Set(owners);
      if (uniqueOwners.size !== 2) {
        return false;
      }
      bedOwners = Array.from(uniqueOwners);
      return true;
    }, {
      timeoutTicks: 80,
      timeoutMessage: '两张床没有被两名不同的小人自动认领',
    }),
    createWaitForStep('等待两张床都被占据', ({ query }) => {
      const bedA = query.findBuildingAt('bed_wood', BED_CELLS[0]) as any;
      const bedB = query.findBuildingAt('bed_wood', BED_CELLS[1]) as any;
      const occupantA = bedA?.bed?.occupantPawnId ?? null;
      const occupantB = bedB?.bed?.occupantPawnId ?? null;
      return occupantA !== null && occupantB !== null && occupantA !== occupantB;
    }, {
      timeoutTicks: 160,
      timeoutMessage: '两张床没有被两名不同的小人占据',
    }),
    createWaitForStep('等待三人都至少恢复到一次有效休息度', ({ query }) => {
      const restored = new Set(restoredSleepers);
      for (const name of PAWN_NAMES) {
        const pawn = query.findPawnByName(name);
        if (pawn !== null && pawn.needs.rest >= RECOVERY_REST_THRESHOLD) {
          restored.add(name);
        }
      }
      restoredSleepers = Array.from(restored);
      return restoredSleepers.length === PAWN_NAMES.length;
    }, {
      timeoutTicks: 1000,
      timeoutMessage: '并非所有小人都通过睡眠恢复到了有效休息度',
    }),
    createWaitForStep('等待床位在醒来后释放 occupant', ({ query }) => {
      const bedA = query.findBuildingAt('bed_wood', BED_CELLS[0]) as any;
      const bedB = query.findBuildingAt('bed_wood', BED_CELLS[1]) as any;
      return !bedA?.bed?.occupantPawnId && !bedB?.bed?.occupantPawnId;
    }, {
      timeoutTicks: 1000,
      timeoutMessage: '小人醒来后床位 occupant 没有释放',
    }),
  ],
  expect: [
    createAssertStep('应有两名小人被记录为床睡眠者', () => bedSleepers.length === 2, {
      failureMessage: `床睡眠者数量不正确: ${bedSleepers.join(', ')}`,
    }),
    createAssertStep('应有一名小人被记录为地板睡眠者', () => floorSleepers.length === 1, {
      failureMessage: `地板睡眠者数量不正确: ${floorSleepers.join(', ')}`,
    }),
    createAssertStep('三名小人都应恢复到过有效休息度', () => {
      return restoredSleepers.length === PAWN_NAMES.length;
    }, {
      failureMessage: '至少有一名小人的休息度没有恢复到有效休息度',
    }),
    createAssertStep('应有两张床被不同小人认领为 owner', () => bedOwners.length === 2, {
      failureMessage: `床 owner 认领数量不正确: ${bedOwners.join(', ')}`,
    }),
    createAssertStep('床 owner 应与床睡眠者一致', () => {
      const expected = [...bedSleepers].sort();
      const actual = [...bedOwners].sort();
      return expected.length === actual.length && expected.every((name, index) => name === actual[index]);
    }, {
      failureMessage: `床 owner 与床睡眠者不一致，owners=${bedOwners.join(', ')} sleepers=${bedSleepers.join(', ')}`,
    }),
    createAssertStep('两张床最终都应为空闲状态', ({ query }) => {
      const bedA = query.findBuildingAt('bed_wood', BED_CELLS[0]) as any;
      const bedB = query.findBuildingAt('bed_wood', BED_CELLS[1]) as any;
      return !bedA?.bed?.occupantPawnId && !bedB?.bed?.occupantPawnId;
    }, {
      failureMessage: '至少有一张床在场景结束时仍被 occupant 占据',
    }),
  ],
});
