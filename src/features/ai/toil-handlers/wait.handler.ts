import { ObjectKind, ToilState, cellEquals } from '../../../core/types';
import { log } from '../../../core/logger';
import type { ToilHandler } from './toil-handler.types';
import { claimBedOccupancy, getBedSleepCell, movePawnInstantly } from '../sleep.utils';

const SLEEP_REST_GAIN_SCALE = 10;

export const executeWait: ToilHandler = ({ pawn, toil, map }) => {
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

    pawn.needs.rest = Math.min(100, pawn.needs.rest + restGain * SLEEP_REST_GAIN_SCALE);

    if (pawn.needs.rest >= pawn.needsProfile.wakeTargetRest) {
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
