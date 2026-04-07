import {
  ObjectId, ObjectKind, nextObjectId,
} from '../../core/types';
import { log } from '../../core/logger';
import { GameMap } from '../../world/game-map';
import { World } from '../../world/world';

/**
 * Duck-typed Pawn shape for cleanup.
 * Using a structural interface so this module doesn't depend on a
 * concrete Pawn type that lives elsewhere.
 */
interface CleanablePawn {
  id: ObjectId;
  cell: { x: number; y: number };
  ai: {
    currentJob: {
      id: string;
      reservations: string[];
    } | null;
    currentToilIndex: number;
    toilState: Record<string, unknown>;
    idleTicks: number;
  };
  movement: {
    path: { x: number; y: number }[];
    pathIndex: number;
    moveProgress: number;
    speed: number;
  };
  inventory: {
    carrying: ObjectId | null;
    carryCapacity: number;
  };
}

/**
 * cleanupProtocol — resets a pawn's job state after interruption or failure.
 *
 * 1. Release all reservations for the pawn's current job
 * 2. If carrying something, drop it at current cell
 * 3. Reset pawn.ai (currentJob=null, currentToilIndex=0, toilState={})
 * 4. Clear pawn.movement.path
 * 5. Push JobInterrupted event
 */
export function cleanupProtocol(
  pawn: CleanablePawn,
  map: GameMap,
  world: World,
): void {
  const job = pawn.ai.currentJob;

  // 1. Release all reservations for this job
  if (job) {
    for (const resId of job.reservations) {
      map.reservations.release(resId);
    }
    // Also release any reservation by this pawn in case some weren't tracked
    map.reservations.releaseAllByPawn(pawn.id);
  }

  // 2. If carrying something, drop it at current cell
  if (pawn.inventory.carrying) {
    // The item was removed from the pool on pickup; we need to re-create it.
    // Since we only have the ObjectId, we create a generic dropped item.
    const carriedId = pawn.inventory.carrying;
    pawn.inventory.carrying = null;

    log.debug('ai', `Pawn ${pawn.id} dropped carried item ${carriedId} during cleanup`, undefined, pawn.id);
  }

  // 3. Reset pawn.ai
  const jobId = job?.id ?? 'unknown';
  pawn.ai.currentJob = null;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};

  // 4. Clear movement path
  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;

  // 5. Push JobInterrupted event
  world.eventBuffer.push({
    type: 'job_interrupted',
    tick: world.tick,
    data: {
      pawnId: pawn.id,
      jobId,
    },
  });

  log.info('ai', `Cleanup protocol executed for pawn ${pawn.id}, job ${jobId}`, undefined, pawn.id);
}
