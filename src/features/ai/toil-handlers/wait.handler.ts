import { ObjectKind, ToilState, cellEquals } from '../../../core/types';
import { getHourFloat, isHourWithinWindow } from '../../../core/clock';
import { log } from '../../../core/logger';
import type { ToilHandler } from './toil-handler.types';
import { claimBedOccupancy, getBedSleepCell, movePawnInstantly } from '../sleep.utils';

type SleepSessionKind = 'scheduled' | 'recovery';

function getScheduledSleepTicks(pawn: Parameters<ToilHandler>[0]['pawn'], world: Parameters<ToilHandler>[0]['world']): number {
  const hourFloat = getHourFloat(world.clock);
  const sleepStartHour = pawn.chronotype.sleepStartHour;
  const sleepEndHour = pawn.chronotype.sleepEndHour;
  const inSleepWindow = isHourWithinWindow(hourFloat, sleepStartHour, sleepEndHour);
  const hoursUntilSleepStart = (((sleepStartHour % 24) - hourFloat + 24) % 24);
  const shouldHonorScheduledSleep = inSleepWindow || hoursUntilSleepStart <= 1;
  if (!shouldHonorScheduledSleep) {
    return 0;
  }

  const hoursUntilSleepEnd = (((sleepEndHour % 24) - hourFloat + 24) % 24) || 24;
  return Math.ceil(hoursUntilSleepEnd * 100);
}

function getRecoverySleepTicks(
  pawn: Parameters<ToilHandler>[0]['pawn'],
  restGainPerTick: number,
): number {
  const restNeeded = Math.max(0, pawn.needsProfile.wakeTargetRest - pawn.needs.rest);
  const netRestGainPerTick = Math.max(0.001, restGainPerTick - pawn.needsProfile.restDecayPerTick);
  return Math.max(1, Math.ceil(restNeeded / netRestGainPerTick));
}

function getSleepSessionPlan(
  pawn: Parameters<ToilHandler>[0]['pawn'],
  world: Parameters<ToilHandler>[0]['world'],
  restGainPerTick: number,
): { kind: SleepSessionKind; targetTicks: number } {
  const scheduledTicks = getScheduledSleepTicks(pawn, world);
  if (scheduledTicks > 0) {
    return { kind: 'scheduled', targetTicks: scheduledTicks };
  }

  return {
    kind: 'recovery',
    targetTicks: getRecoverySleepTicks(pawn, restGainPerTick),
  };
}

export const executeWait: ToilHandler = ({ pawn, toil, map, world }) => {
  const ld = toil.localData;
  const waited = (ld.waited as number) ?? 0;
  const waitTicks = (ld.waitTicks as number) ?? 60;

  ld.waited = waited + 1;

  if (ld.sleeping) {
    const bedId = typeof ld.bedId === 'string' ? ld.bedId : undefined;
    let restGain = pawn.needsProfile.floorRestGainPerTick;

    if (bedId) {
      if (!claimBedOccupancy(map, pawn, bedId)) {
        toil.state = ToilState.Failed;
        return;
      }

      const bed = map.objects.getAs(bedId, ObjectKind.Building);
      const sleepCell = getBedSleepCell(map, bedId);
      if (sleepCell && !cellEquals(pawn.cell, sleepCell)) {
        movePawnInstantly(map, pawn, sleepCell);
      }

      restGain = pawn.needsProfile.bedRestGainPerTick * (bed?.bed?.restRateMultiplier ?? 1);
    }

    const existingSessionKind = ld.sleepSessionKind === 'scheduled' || ld.sleepSessionKind === 'recovery'
      ? ld.sleepSessionKind
      : null;
    const existingSessionTargetTicks = typeof ld.sleepSessionTargetTicks === 'number'
      ? ld.sleepSessionTargetTicks
      : null;
    const sessionPlan = existingSessionKind && existingSessionTargetTicks
      ? { kind: existingSessionKind, targetTicks: existingSessionTargetTicks }
      : getSleepSessionPlan(pawn, world, restGain);

    ld.sleepSessionKind = sessionPlan.kind;
    ld.sleepSessionTargetTicks = sessionPlan.targetTicks;
    // Backward-compatible alias for any existing debug tooling still reading the old field.
    ld.sleepTicksTarget = sessionPlan.targetTicks;

    pawn.needs.rest = Math.min(100, pawn.needs.rest + restGain);

    const completedSleepSession = waited + 1 >= sessionPlan.targetTicks;
    const completedRecoverySleep = (
      sessionPlan.kind === 'recovery'
      && pawn.needs.rest >= pawn.needsProfile.wakeTargetRest
    );
    if (completedSleepSession || completedRecoverySleep) {
      toil.state = ToilState.Completed;
      log.debug('ai', `Pawn ${pawn.id} woke up with rest ${Math.floor(pawn.needs.rest)}`, undefined, pawn.id);
    }
    return;
  }

  if ((ld.waited as number) >= waitTicks) {
    if (ld.eating) {
      if (!pawn.inventory.carrying) {
        log.warn('ai', `Pawn ${pawn.id} finished eating wait without carried food`, undefined, pawn.id);
        toil.state = ToilState.Failed;
        return;
      }

      pawn.needs.food = Math.min(100, pawn.needs.food + ((ld.nutritionGain as number) ?? 30));
      pawn.inventory.carrying = null;
      log.debug('ai', `Pawn ${pawn.id} finished eating, food: ${Math.floor(pawn.needs.food)}`, undefined, pawn.id);
    }
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} finished waiting (${waitTicks} ticks)`, undefined, pawn.id);
  }
};
