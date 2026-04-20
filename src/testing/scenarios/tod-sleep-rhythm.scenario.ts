import { ObjectKind } from '@core/types';
import {
  createAssertStep,
  createScenario,
  createSetupStep,
  createWaitForStep,
} from '../scenario-dsl/scenario.builders';
import {
  setPawnRestFixture,
  spawnBuildingFixture,
  spawnItemFixture,
  spawnPawnFixture,
} from '../scenario-fixtures/world-fixtures';
import {
  setWorldClockHourFixture,
  setPawnChronotypeFixture,
  spawnPawnWithTraitsFixture,
} from '../scenario-fixtures/tod-fixtures';

const NORMAL_PAWN = 'Normal';
const NIGHT_OWL_PAWN = 'Night Owl';
const HIGH_ENERGY_PAWN = 'High Energy';
const REST_RECOVERY_THRESHOLD = 60;

const BED_CELLS = [
  { x: 19, y: 8 },
  { x: 19, y: 11 },
  { x: 19, y: 14 },
] as const;

const STORAGE_BUILDING_CELL = { x: 26, y: 8 } as const;

const WOOD_SOURCE_CELLS = [
  { x: 6, y: 8 },
  { x: 7, y: 8 },
  { x: 8, y: 8 },
] as const;

let sleepSequence: string[] = [];
let recoveredNames: string[] = [];
let specialWorkObserved = false;

function findBedAt(query: { findBuildingAt(defId: string, cell: { x: number; y: number }): unknown | null }, cell: { x: number; y: number }) {
  return query.findBuildingAt('bed_wood', cell) as any;
}

export const todSleepRhythmScenario = createScenario({
  id: 'tod-sleep-rhythm',
  title: 'TOD 睡眠节律',
  description: '验证普通 pawn 会比 night_owl / high_energy 更早入睡，且夜间作业和床位清理保持正常。',
  report: {
    focus: '关注 TOD 驱动的入睡顺序、特殊体质的延后睡眠，以及床位 occupancy 的最终释放。',
  },
  setup: [
    createSetupStep('重置场景记录', () => {
      sleepSequence = [];
      recoveredNames = [];
      specialWorkObserved = false;
    }),
    setWorldClockHourFixture(21),
    spawnBuildingFixture('bed_wood', BED_CELLS[0]),
    spawnBuildingFixture('bed_wood', BED_CELLS[1]),
    spawnBuildingFixture('bed_wood', BED_CELLS[2]),
    spawnBuildingFixture('warehouse_shed', STORAGE_BUILDING_CELL),
    spawnPawnFixture({ x: 10, y: 8 }, NORMAL_PAWN),
    spawnPawnWithTraitsFixture({ x: 10, y: 11 }, NIGHT_OWL_PAWN, ['night_owl']),
    spawnPawnWithTraitsFixture({ x: 10, y: 14 }, HIGH_ENERGY_PAWN, ['high_energy']),
    setPawnChronotypeFixture(NORMAL_PAWN, {
      scheduleShiftHours: 0,
      sleepStartHour: 22,
      sleepDurationHours: 8,
      sleepEndHour: 30,
      nightOwlBias: 0,
    }),
    setPawnChronotypeFixture(NIGHT_OWL_PAWN, {
      scheduleShiftHours: 0,
      sleepStartHour: 25,
      sleepDurationHours: 8,
      sleepEndHour: 33,
      nightOwlBias: -0.35,
    }),
    setPawnChronotypeFixture(HIGH_ENERGY_PAWN, {
      scheduleShiftHours: 0,
      sleepStartHour: 23,
      sleepDurationHours: 8,
      sleepEndHour: 31,
      nightOwlBias: -0.18,
    }),
    setPawnRestFixture(NORMAL_PAWN, 55),
    setPawnRestFixture(NIGHT_OWL_PAWN, 55),
    setPawnRestFixture(HIGH_ENERGY_PAWN, 60),
    ...WOOD_SOURCE_CELLS.map(cell => spawnItemFixture('wood', cell, 1)),
    createSetupStep('预先分配床位 owner', ({ harness }) => {
      const beds = harness.map.objects.allOfKind(ObjectKind.Building) as any[];
      const normalBed = beds.find(bed => bed?.bed && bed.cell.x === BED_CELLS[0].x && bed.cell.y === BED_CELLS[0].y);
      const owlBed = beds.find(bed => bed?.bed && bed.cell.x === BED_CELLS[1].x && bed.cell.y === BED_CELLS[1].y);
      const highBed = beds.find(bed => bed?.bed && bed.cell.x === BED_CELLS[2].x && bed.cell.y === BED_CELLS[2].y);

      if (normalBed?.bed) normalBed.bed.ownerPawnId = NORMAL_PAWN;
      if (owlBed?.bed) owlBed.bed.ownerPawnId = NIGHT_OWL_PAWN;
      if (highBed?.bed) highBed.bed.ownerPawnId = HIGH_ENERGY_PAWN;
    }),
  ],
  script: [
    createWaitForStep('普通 pawn 先进入睡眠', ({ query }) => {
      const normal = query.findPawnByName(NORMAL_PAWN);
      const nightOwl = query.findPawnByName(NIGHT_OWL_PAWN);
      const highEnergy = query.findPawnByName(HIGH_ENERGY_PAWN);

      if (nightOwl?.ai.currentJob?.defId === 'job_sleep' || highEnergy?.ai.currentJob?.defId === 'job_sleep') {
        return false;
      }

      const normalSleeping = normal?.ai.currentJob?.defId === 'job_sleep';
      if (normalSleeping) {
        if (!sleepSequence.includes(NORMAL_PAWN)) sleepSequence.push(NORMAL_PAWN);
        return true;
      }

      return false;
    }, {
      timeoutTicks: 160,
      timeoutMessage: '普通 pawn 没有在夜间优先进入睡眠，或者特殊 pawn 过早睡下。',
    }),
    createWaitForStep('特殊 pawn 仍保持非睡眠工作', ({ query }) => {
      const nightOwl = query.findPawnByName(NIGHT_OWL_PAWN);
      const highEnergy = query.findPawnByName(HIGH_ENERGY_PAWN);

      const nightOwlJob = nightOwl?.ai.currentJob?.defId ?? null;
      const highEnergyJob = highEnergy?.ai.currentJob?.defId ?? null;
      const bothActive = nightOwlJob !== null && nightOwlJob !== 'job_sleep'
        && highEnergyJob !== null && highEnergyJob !== 'job_sleep';

      if (bothActive) {
        specialWorkObserved = true;
      }

      return bothActive;
    }, {
      timeoutTicks: 120,
      timeoutMessage: '特殊 pawn 在普通 pawn 睡下后没有继续保持工作状态。',
    }),
    createWaitForStep('Night Owl 最终入睡', ({ query }) => {
      const pawn = query.findPawnByName(NIGHT_OWL_PAWN);
      if (pawn?.ai.currentJob?.defId === 'job_sleep') {
        if (!sleepSequence.includes(NIGHT_OWL_PAWN)) sleepSequence.push(NIGHT_OWL_PAWN);
        return true;
      }
      return false;
    }, {
      timeoutTicks: 480,
      timeoutMessage: 'Night Owl 迟迟没有进入睡眠，TOD 延后效果可能失效。',
    }),
    createWaitForStep('High Energy 最终入睡', ({ query }) => {
      const pawn = query.findPawnByName(HIGH_ENERGY_PAWN);
      if (pawn?.ai.currentJob?.defId === 'job_sleep') {
        if (!sleepSequence.includes(HIGH_ENERGY_PAWN)) sleepSequence.push(HIGH_ENERGY_PAWN);
        return true;
      }
      return false;
    }, {
      timeoutTicks: 700,
      timeoutMessage: 'High Energy 迟迟没有进入睡眠，夜间偏置可能过强。',
    }),
    createWaitForStep('三名 pawn 都恢复到安全 rest', ({ query }) => {
      const names = [NORMAL_PAWN, NIGHT_OWL_PAWN, HIGH_ENERGY_PAWN];
      for (const name of names) {
        const pawn = query.findPawnByName(name);
        if (pawn && pawn.needs.rest >= REST_RECOVERY_THRESHOLD && !recoveredNames.includes(name)) {
          recoveredNames.push(name);
        }
      }
      return recoveredNames.length === names.length;
    }, {
      timeoutTicks: 420,
      timeoutMessage: '至少有一名 pawn 没有在夜间睡眠后恢复到安全 rest。',
    }),
    createWaitForStep('床位最终释放 occupant', ({ query }) => {
      return BED_CELLS.every((cell) => {
        const bed = findBedAt(query, cell);
        return !bed?.bed?.occupantPawnId;
      });
    }, {
      timeoutTicks: 1400,
      timeoutMessage: '至少有一张床在场景结束时仍然被 occupant 占用。',
    }),
  ],
  expect: [
    createAssertStep('普通 pawn 应最先入睡', () => {
      return sleepSequence[0] === NORMAL_PAWN
        && sleepSequence.includes(NIGHT_OWL_PAWN)
        && sleepSequence.includes(HIGH_ENERGY_PAWN);
    }, {
      failureMessage: `入睡顺序不符合预期: ${sleepSequence.join(' -> ')}`,
    }),
    createAssertStep('特殊 pawn 在普通 pawn 睡下后保持过非睡眠工作', () => specialWorkObserved, {
      failureMessage: '特殊 pawn 没有在普通 pawn 入睡后继续保持工作状态。',
    }),
    createAssertStep('三名 pawn 都应恢复到安全 rest', () => recoveredNames.length === 3, {
      failureMessage: `未全部恢复到安全 rest: ${recoveredNames.join(', ')}`,
    }),
    createAssertStep('床位应在结束时清空', ({ query }) => {
      return BED_CELLS.every((cell) => {
        const bed = findBedAt(query, cell);
        return !bed?.bed?.occupantPawnId;
      });
    }, {
      failureMessage: '场景结束时仍有床位 occupant 未释放。',
    }),
  ],
});
