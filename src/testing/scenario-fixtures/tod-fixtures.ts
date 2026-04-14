/**
 * @file tod-fixtures.ts
 * @description Time-of-day / chronotype helpers for headless scenario setup.
 */

import { createSetupStep } from '../scenario-dsl/scenario.builders';
import type { SetupStep } from '../scenario-dsl/scenario.types';
import { createPawn } from '@features/pawn/pawn.factory';
import { ObjectKind } from '@core/types';
import type { Pawn, PawnChronotype } from '@features/pawn/pawn.types';
import { createScheduleEntriesForChronotype } from '@features/pawn/pawn.systems';

/**
 * Spawn a pawn with explicit trait ids.
 */
export function spawnPawnWithTraitsFixture(
  cell: { x: number; y: number },
  name = 'Tester',
  traitIds: string[] = [],
): SetupStep {
  return createSetupStep(`Spawn pawn ${name}`, ({ harness }) => {
    const pawn = createPawn({
      name,
      cell,
      mapId: harness.map.id,
      factionId: 'player',
      rng: harness.world.rng,
      traitIds,
    });
    harness.map.objects.add(pawn);
  });
}

/**
 * Set the world clock to a specific hour.
 */
export function setWorldClockHourFixture(hour: number): SetupStep {
  return createSetupStep(`Set clock to ${hour}:00`, ({ harness }) => {
    const normalizedHour = ((hour % 24) + 24) % 24;
    let deltaHours = normalizedHour - 6;
    if (deltaHours < 0) deltaHours += 24;
    const totalTicks = deltaHours * 100;

    harness.world.tick = totalTicks;
    harness.world.clock.totalTicks = totalTicks;
    harness.world.clock.hour = normalizedHour;
    harness.world.clock.day = 1;
    harness.world.clock.season = 0;
    harness.world.clock.year = 1;
  });
}

/**
 * Override a pawn chronotype for deterministic scenario behavior.
 */
export function setPawnChronotypeFixture(
  pawnName: string,
  chronotype: PawnChronotype,
): SetupStep {
  return createSetupStep(`Set chronotype for ${pawnName}`, ({ harness }) => {
    const pawns = harness.map.objects.allOfKind(ObjectKind.Pawn) as Pawn[];
    const pawn = pawns.find(entry => entry.name === pawnName);
    if (!pawn) throw new Error(`Pawn "${pawnName}" not found`);

    pawn.chronotype = { ...chronotype };
    pawn.schedule.entries = createScheduleEntriesForChronotype(pawn.chronotype);
  });
}
