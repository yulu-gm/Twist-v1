import {
  createAssertStep,
  createScenario,
  createSetupStep,
  createWaitForStep,
} from '../scenario-dsl/scenario.builders';
import { ObjectKind } from '@core/types';
import {
  setPawnRestFixture,
  spawnItemFixture,
  spawnPawnFixture,
} from '../scenario-fixtures/world-fixtures';
import { placeBlueprintCommand } from '../scenario-commands/player-commands';
import { createPawn } from '@features/pawn/pawn.factory';

const BUILDER_NAMES = ['Builder-A', 'Builder-B'] as const;
const SLEEPER_NAMES = ['Sleeper-A', 'Sleeper-B', 'Sleeper-C'] as const;
const BED_CELLS = [
  { x: 15, y: 8 },
  { x: 15, y: 11 },
  { x: 15, y: 14 },
] as const;
const MATERIAL_CELLS = [
  { x: 10, y: 8 },
  { x: 10, y: 11 },
  { x: 10, y: 14 },
] as const;
const REST_TRIGGER_VALUE = 10;
const REST_RECOVERY_VALUE = 60;

let builtBedIds: string[] = [];
let ownerNames: string[] = [];
let occupantNames: string[] = [];
let recoveredNames: string[] = [];

export const bedBlueprintSleepScenario = createScenario({
  id: 'bed-blueprint-sleep',
  title: '批量建床后投入睡眠',
  description: '验证多张 bed_wood 蓝图会被建造完成，预分配 owner 的低休息度小人会在床上睡眠恢复。',
  report: {
    focus: '关注多床施工、sleep job 选床、owner 预分配 pawn.name，以及 occupant 占用与休息恢复。',
  },
  setup: [
    createSetupStep('重置场景记录', () => {
      builtBedIds = [];
      ownerNames = [];
      occupantNames = [];
      recoveredNames = [];
    }),
    spawnPawnFixture({ x: 9, y: 8 }, BUILDER_NAMES[0]),
    spawnPawnFixture({ x: 9, y: 14 }, BUILDER_NAMES[1]),
    ...BUILDER_NAMES.map((name) => setPawnRestFixture(name, 100)),
    ...MATERIAL_CELLS.map((cell) => spawnItemFixture('wood', cell, 8)),
  ],
  script: [
    ...BED_CELLS.map((cell) => placeBlueprintCommand('bed_wood', cell)),
    createWaitForStep('等待三张木床全部建成', ({ query }) => {
      const beds = BED_CELLS
        .map(cell => query.findBuildingAt('bed_wood', cell))
        .filter((bed): bed is NonNullable<typeof bed> => bed !== null);
      builtBedIds = beds.map(bed => bed.id);
      return beds.length === BED_CELLS.length;
    }, {
      timeoutTicks: 1200,
      timeoutMessage: '三张 bed_wood 没有在预期时间内全部建成',
    }),
    createSetupStep('生成三名 sleeper 并压低休息度，预分配床位所有权', ({ harness }) => {
      for (const name of SLEEPER_NAMES) {
        const sleeper = createPawn({
          name,
          cell: { x: 20, y: 8 + SLEEPER_NAMES.indexOf(name) * 3 },
          mapId: harness.map.id,
          factionId: 'player',
          rng: harness.world.rng,
        });
        sleeper.needs.rest = REST_TRIGGER_VALUE;
        harness.map.objects.add(sleeper);
      }
      // 预先分配床位所有权给每名 sleeper（不再依赖自动认领）
      const beds = harness.map.objects.allOfKind(ObjectKind.Building) as any[];
      for (let i = 0; i < SLEEPER_NAMES.length; i++) {
        const bed = beds.find(
          b => b.bed && b.cell.x === BED_CELLS[i].x && b.cell.y === BED_CELLS[i].y,
        );
        if (bed?.bed) bed.bed.ownerPawnId = SLEEPER_NAMES[i];
      }
    }),
    createWaitForStep('等待三名 sleeper 使用预分配的床睡眠', ({ query }) => {
      const claimedOwners = new Set<string>();

      for (const name of SLEEPER_NAMES) {
        const sleeper = query.findPawnByName(name) as any;
        if (!sleeper || sleeper.ai.currentJob?.defId !== 'job_sleep' || !sleeper.ai.currentJob?.targetId) {
          return false;
        }
      }

      for (const cell of BED_CELLS) {
        const bed = query.findBuildingAt('bed_wood', cell) as any;
        if (!bed?.bed?.ownerPawnId) {
          return false;
        }
        claimedOwners.add(bed.bed.ownerPawnId);
      }

      ownerNames = Array.from(claimedOwners);
      return claimedOwners.size === SLEEPER_NAMES.length
        && SLEEPER_NAMES.every(name => claimedOwners.has(name));
    }, {
      timeoutTicks: 120,
      timeoutMessage: '三名 sleeper 没有使用预分配的床进行睡眠',
    }),
    createWaitForStep('等待三张木床都被不同 sleeper 占用', ({ query }) => {
      const occupiedBy = new Set<string>();

      for (const cell of BED_CELLS) {
        const bed = query.findBuildingAt('bed_wood', cell) as any;
        const occupantId = bed?.bed?.occupantPawnId;
        if (!occupantId) {
          return false;
        }

        const pawn = SLEEPER_NAMES
          .map(name => query.findPawnByName(name) as any)
          .find(candidate => candidate?.id === occupantId);
        if (!pawn) {
          return false;
        }
        occupiedBy.add(pawn.name);
      }

      occupantNames = Array.from(occupiedBy);
      return occupiedBy.size === SLEEPER_NAMES.length;
    }, {
      timeoutTicks: 220,
      timeoutMessage: '三张木床没有被三名不同 sleeper 实际占用',
    }),
    createWaitForStep('等待三名 sleeper 在床上恢复休息度', ({ query }) => {
      const recovered = new Set(recoveredNames);
      for (const name of SLEEPER_NAMES) {
        const pawn = query.findPawnByName(name) as any;
        if (pawn && pawn.needs.rest >= REST_RECOVERY_VALUE) {
          recovered.add(name);
        }
      }
      recoveredNames = Array.from(recovered);
      return recoveredNames.length === SLEEPER_NAMES.length;
    }, {
      timeoutTicks: 320,
      timeoutMessage: '并非所有 sleeper 都在床上恢复到了有效休息度',
    }),
    createWaitForStep('等待三张木床在醒来后释放 occupant', ({ query }) => {
      return BED_CELLS.every((cell) => {
        const bed = query.findBuildingAt('bed_wood', cell) as any;
        return !!bed && !bed.bed?.occupantPawnId;
      });
    }, {
      timeoutTicks: 160,
      timeoutMessage: '至少有一张木床在 sleeper 醒来后仍然保留 occupant',
    }),
  ],
  expect: [
    createAssertStep('应建成三张木床', ({ query }) => {
      const beds = BED_CELLS
        .map(cell => query.findBuildingAt('bed_wood', cell))
        .filter((bed): bed is NonNullable<typeof bed> => bed !== null);
      return beds.length === BED_CELLS.length;
    }, {
      failureMessage: '场景结束时没有看到三张建成的木床',
    }),
    createAssertStep('三张木床应按 sleeper 名字完成 owner 预分配', () => {
      return ownerNames.length === SLEEPER_NAMES.length
        && SLEEPER_NAMES.every(name => ownerNames.includes(name));
    }, {
      failureMessage: `木床 owner 认领结果不正确: ${ownerNames.join(', ')}`,
    }),
    createAssertStep('三名 sleeper 都应实际睡到床上', () => {
      return occupantNames.length === SLEEPER_NAMES.length
        && SLEEPER_NAMES.every(name => occupantNames.includes(name));
    }, {
      failureMessage: `床位占用记录不完整: ${occupantNames.join(', ')}`,
    }),
    createAssertStep('三名 sleeper 都应恢复到有效休息度', () => {
      return recoveredNames.length === SLEEPER_NAMES.length;
    }, {
      failureMessage: `未恢复到有效休息度的 sleeper 仍存在，当前记录: ${recoveredNames.join(', ')}`,
    }),
    createAssertStep('建成后的木床对象应保持稳定', ({ query }) => {
      const currentIds = BED_CELLS
        .map(cell => query.findBuildingAt('bed_wood', cell) as any)
        .filter(Boolean)
        .map(bed => bed.id)
        .sort();
      const expectedIds = [...builtBedIds].sort();
      return currentIds.length === expectedIds.length
        && currentIds.every((id, index) => id === expectedIds[index]);
    }, {
      failureMessage: '建成后的木床对象发生了替换或缺失',
    }),
  ],
});
