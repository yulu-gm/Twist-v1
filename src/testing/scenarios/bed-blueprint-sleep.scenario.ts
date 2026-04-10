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

const BUILDER_NAME = 'Builder';
const SLEEPER_NAME = 'Sleeper';
const BED_CELL = { x: 15, y: 10 };
const MATERIAL_CELL = { x: 11, y: 10 };
const REST_TRIGGER_VALUE = 10;
const REST_RECOVERY_VALUE = 60;

let builtBedId: string | null = null;
let bedSleeperId: string | null = null;
let recoveredOnBed = false;

export const bedBlueprintSleepScenario = createScenario({
  id: 'bed-blueprint-sleep',
  title: '建造床位后投入睡眠',
  description: '验证木床蓝图会被施工完成，并且低休息度小人会把新床当作睡眠目标使用。',
  report: {
    focus: '关注床蓝图施工、bed_wood 落地、sleep job 选床，以及 occupant 占用与休息度恢复。',
  },
  setup: [
    createSetupStep('重置场景记录', () => {
      builtBedId = null;
      bedSleeperId = null;
      recoveredOnBed = false;
    }),
    spawnPawnFixture({ x: 10, y: 10 }, BUILDER_NAME),
    spawnPawnFixture({ x: 20, y: 10 }, SLEEPER_NAME),
    setPawnRestFixture(BUILDER_NAME, 100),
    setPawnRestFixture(SLEEPER_NAME, 100),
    spawnItemFixture('wood', MATERIAL_CELL, 20),
  ],
  script: [
    placeBlueprintCommand('bed_wood', BED_CELL),
    createWaitForStep('等待木床蓝图材料送达', ({ query }) => {
      return !query.findBlueprintsByTargetDef('bed_wood').some((bp: any) => bp.targetDefId === 'bed_wood');
    }, {
      timeoutTicks: 300,
      timeoutMessage: '木床蓝图的材料没有按时送达',
    }),
    createWaitForStep('等待木床建造完成', ({ query }) => {
      const bed = query.findBuildingAt('bed_wood', BED_CELL);
      if (!bed) return false;
      builtBedId = bed.id;
      return true;
    }, {
      timeoutTicks: 500,
      timeoutMessage: '木床没有在预期时间内建造完成',
    }),
    createSetupStep('压低 Sleeper 的休息度以触发睡眠需求', ({ harness }) => {
      const sleeper = harness.map.objects.allOfKind(ObjectKind.Pawn).find((pawn: any) => pawn.name === SLEEPER_NAME) as any;
      if (!sleeper) throw new Error(`Pawn "${SLEEPER_NAME}" not found`);
      sleeper.needs.rest = REST_TRIGGER_VALUE;
    }),
    createWaitForStep('等待 Sleeper 领取新床的睡眠工作', ({ query }) => {
      const sleeper = query.findPawnByName(SLEEPER_NAME) as any;
      const bed = query.findBuildingAt('bed_wood', BED_CELL) as any;
      if (!sleeper || !bed) return false;
      const usesBed = sleeper.ai.currentJob?.defId === 'job_sleep' && sleeper.ai.currentJob?.targetId === bed.id;
      if (usesBed) {
        bedSleeperId = sleeper.id;
      }
      return usesBed;
    }, {
      timeoutTicks: 80,
      timeoutMessage: 'Sleeper 没有把新建木床作为睡眠目标',
    }),
    createWaitForStep('等待 Sleeper 真正占用木床', ({ query }) => {
      const sleeper = query.findPawnByName(SLEEPER_NAME) as any;
      const bed = query.findBuildingAt('bed_wood', BED_CELL) as any;
      if (!sleeper || !bed?.bed) return false;
      const occupied = bed.bed.occupantPawnId === sleeper.id;
      if (occupied) {
        bedSleeperId = sleeper.id;
      }
      return occupied;
    }, {
      timeoutTicks: 120,
      timeoutMessage: 'Sleeper 没有进入新建木床并形成 occupant 占用',
    }),
    createWaitForStep('等待 Sleeper 通过床睡眠恢复休息度', ({ query }) => {
      const sleeper = query.findPawnByName(SLEEPER_NAME) as any;
      const bed = query.findBuildingAt('bed_wood', BED_CELL) as any;
      if (!sleeper || !bed?.bed) return false;
      const recovered = sleeper.needs.rest >= REST_RECOVERY_VALUE && bed.bed.occupantPawnId === sleeper.id;
      if (recovered) {
        recoveredOnBed = true;
      }
      return recovered;
    }, {
      timeoutTicks: 220,
      timeoutMessage: 'Sleeper 没有在木床上恢复到有效休息度',
    }),
    createWaitForStep('等待木床在醒来后释放占用', ({ query }) => {
      const bed = query.findBuildingAt('bed_wood', BED_CELL) as any;
      return !!bed && !bed.bed?.occupantPawnId;
    }, {
      timeoutTicks: 160,
      timeoutMessage: 'Sleeper 醒来后木床没有释放 occupant 占用',
    }),
  ],
  expect: [
    createAssertStep('应已建成一张木床', ({ query }) => {
      return query.findBuildingAt('bed_wood', BED_CELL) !== null;
    }, {
      failureMessage: '场景结束时没有找到建成的木床',
    }),
    createAssertStep('Sleeper 应领取过新床的睡眠工作', () => bedSleeperId !== null, {
      failureMessage: '没有记录到 Sleeper 使用新床的睡眠工作',
    }),
    createAssertStep('Sleeper 应在床上恢复过休息度', () => recoveredOnBed, {
      failureMessage: '没有观察到 Sleeper 在木床 occupant 状态下恢复休息度',
    }),
    createAssertStep('木床应保留在场景内', ({ query }) => {
      const bed = query.findBuildingAt('bed_wood', BED_CELL) as any;
      return bed?.id === builtBedId;
    }, {
      failureMessage: '建成后的木床不存在或对象已被替换',
    }),
  ],
});
