import { JobState } from '../../core/types';
import { log } from '../../core/logger';
import type { Pawn } from '../pawn/pawn.types';
import type { Job } from './ai.types';
import type { GameMap } from '../../world/game-map';
import type { World } from '../../world/world';
import { releaseOccupiedBedForPawn } from './sleep.utils';

export function advanceToil(pawn: Pawn, job: Job, map: GameMap, world: World): void {
  job.currentToilIndex++;
  pawn.ai.currentToilIndex = job.currentToilIndex;

  if (job.currentToilIndex >= job.toils.length) {
    completeJob(pawn, map, world);
  }
}

export function completeJob(pawn: Pawn, map: GameMap | null, world: World): void {
  const job = pawn.ai.currentJob;
  if (!job) return;

  job.state = JobState.Done;

  if (map) {
    for (const resId of job.reservations) {
      map.reservations.release(resId);
    }
  }

  releaseOccupiedBedForPawn(map, pawn);

  log.info('ai', `Pawn ${pawn.id} completed job ${job.id} (${job.defId})`, undefined, pawn.id);

  world.eventBuffer.push({
    type: 'job_completed',
    tick: world.tick,
    data: { pawnId: pawn.id, jobId: job.id, defId: job.defId },
  });

  pawn.ai.currentJob = null;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};
  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;
}
