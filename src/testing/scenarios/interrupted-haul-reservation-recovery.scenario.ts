/**
 * @file interrupted-haul-reservation-recovery.scenario.ts
 * @description 中断搬运后的预约恢复长剧本 — 验证搬运链被 draft_pawn 中断后，
 *              reservation 是否释放、旧 carrying 是否清理、其他 pawn 是否能接手并最终完成目标。
 *              本场景是条件最复杂、价值最高的回归场景。
 * @part-of testing/scenarios — 业务场景库
 */

import {
  createScenario,
  createSetupStep,
  createWaitForStep,
  createCommandStep,
} from '../scenario-dsl/scenario.builders';
import { spawnItemFixture, spawnPawnFixture } from '../scenario-fixtures/world-fixtures';
import { createZoneCommand } from '../scenario-commands/zone-commands';
import { placeBlueprintCommand } from '../scenario-commands/player-commands';
import {
  waitForBlueprintDelivered,
  waitForBuildingCreated,
  assertBuildingExists,
} from '../scenario-probes/building-probes';
import { assertItemCountConserved } from '../scenario-probes/item-probes';
import { assertPawnNotCarrying } from '../scenario-probes/pawn-probes';
import {
  waitForReservationReleased,
  assertReservationReleased,
} from '../scenario-probes/reservation-probes';

let interruptedPawnName: 'Hauler-A' | 'Hauler-B' | null = null;
let recoveryPawnName: 'Hauler-A' | 'Hauler-B' | null = null;

export const interruptedHaulReservationRecoveryScenario = createScenario({
  id: 'interrupted-haul-reservation-recovery',
  title: '中断搬运后的预约恢复',
  description: '验证 haul/deliver 链在被中断后，reservation 能释放并由其他 pawn 接手完成',
  report: {
    focus: '关注中断后的 cleanup、reservation 释放，以及第二个 pawn 是否能顺利接力',
  },
  setup: [
    createScenarioResetStep(),
    spawnPawnFixture({ x: 8, y: 10 }, 'Hauler-A'),
    spawnPawnFixture({ x: 8, y: 12 }, 'Hauler-B'),
    spawnItemFixture('wood', { x: 4, y: 10 }, 15, { alias: 'sourceWood' }),
  ],
  script: [
    createZoneCommand('stockpile', [{ x: 14, y: 9 }, { x: 14, y: 10 }, { x: 14, y: 11 }]),
    placeBlueprintCommand('wall_wood', { x: 16, y: 10 }),
    waitForAnyPawnCarryingWood(300),
    draftInterruptedPawnCommand(),
    waitForReservationReleased('等待源木材 reservation 释放', 'sourceWood', 120),
    waitForRecoveryPawnDelivering(240),
    waitForBlueprintDelivered('等待蓝图材料送达', 'wall_wood', 300),
    waitForBuildingCreated('等待建筑完成', 'wall_wood', { x: 16, y: 10 }, 800),
  ],
  expect: [
    assertBuildingExists('wall_wood', { x: 16, y: 10 }),
    assertPawnNotCarrying('Hauler-A'),
    assertReservationReleased('sourceWood'),
    assertItemCountConserved('wood', 15),
  ],
});

function createScenarioResetStep() {
  return createSetupStep('重置中断/接手 pawn 记录', () => {
    interruptedPawnName = null;
    recoveryPawnName = null;
  });
}

function waitForAnyPawnCarryingWood(timeoutTicks: number) {
  return createWaitForStep('等待有 pawn 拿起木材', ({ query }) => {
    const a = query.findPawnByName('Hauler-A');
    if (a?.inventory.carrying?.defId === 'wood') {
      interruptedPawnName = 'Hauler-A';
      recoveryPawnName = 'Hauler-B';
      return true;
    }

    const b = query.findPawnByName('Hauler-B');
    if (b?.inventory.carrying?.defId === 'wood') {
      interruptedPawnName = 'Hauler-B';
      recoveryPawnName = 'Hauler-A';
      return true;
    }

    return false;
  }, { timeoutTicks, timeoutMessage: '没有 pawn 开始携带木材' });
}

function draftInterruptedPawnCommand() {
  return createCommandStep('征召正在携带木材的 pawn', ({ issueCommand, query, stepTicks }) => {
    if (!interruptedPawnName) {
      throw new Error('尚未记录需要中断的 pawn');
    }

    const pawn = query.findPawnByName(interruptedPawnName);
    if (!pawn) {
      throw new Error(`Pawn "${interruptedPawnName}" not found`);
    }

    issueCommand({ type: 'draft_pawn', payload: { pawnId: pawn.id } });
    stepTicks(1);
  });
}

function waitForRecoveryPawnDelivering(timeoutTicks: number) {
  return createWaitForStep('等待另一名 pawn 接手送材工作', ({ query }) => {
    if (!recoveryPawnName) {
      return false;
    }

    const pawn = query.findPawnByName(recoveryPawnName);
    return pawn?.ai.currentJob?.defId === 'job_deliver_materials';
  }, {
    timeoutTicks,
    timeoutMessage: '另一名 pawn 未接手送材工作',
  });
}
