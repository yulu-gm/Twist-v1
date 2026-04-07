import { TickPhase } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { World } from '../../world/world';

/**
 * Reservation cleanup system.
 *
 * Every tick, scan all maps and release any reservations whose
 * expiry tick has been reached.
 */
function reservationCleanupExecute(world: World): void {
  for (const [, map] of world.maps) {
    map.reservations.cleanupExpired(world.tick);
  }
}

export const reservationCleanupSystem: SystemRegistration = {
  id: 'reservationCleanup',
  phase: TickPhase.CLEANUP,
  frequency: 1,
  execute: reservationCleanupExecute,
};
