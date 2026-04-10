import { log } from '../../core/logger';
import { GameMap } from '../../world/game-map';
import { World } from '../../world/world';
import { placeItemOnMap } from '../item/item.placement';
import type { Pawn } from '../pawn/pawn.types';
import { releaseOccupiedBedForPawn } from './sleep.utils';

export function cleanupProtocol(
  pawn: Pawn,
  map: GameMap,
  world: World,
  reason?: string,
): void {
  const job = pawn.ai.currentJob;

  if (job) {
    for (const resId of job.reservations) {
      map.reservations.release(resId);
    }
    map.reservations.releaseAllByPawn(pawn.id);
  }

  releaseOccupiedBedForPawn(map, pawn);

  if (pawn.inventory.carrying) {
    const carrying = pawn.inventory.carrying;
    const result = placeItemOnMap({
      map,
      defs: world.defs,
      defId: carrying.defId,
      count: carrying.count,
      preferredCell: pawn.cell,
      searchScope: 'nearest-compatible',
      noCapacityPolicy: 'force-overflow',
    });

    if (!result.success || result.remainingCount > 0) {
      log.warn('ai', `Cleanup drop for pawn ${pawn.id} had remainder for ${carrying.defId}`, {
        placedCount: result.placedCount,
        remainingCount: result.remainingCount,
        usedFallback: result.usedFallback,
        usedCells: result.usedCells,
      }, pawn.id);
    }

    if (result.remainingCount <= 0) {
      pawn.inventory.carrying = null;
    } else {
      pawn.inventory.carrying = {
        defId: carrying.defId,
        count: result.remainingCount,
      };
    }

    const actualCell = result.usedCells[0] ?? pawn.cell;
    log.debug(
      'ai',
      `Pawn ${pawn.id} dropped ${carrying.defId} x${result.placedCount} during cleanup at (${actualCell.x},${actualCell.y}) (fallback=${result.usedFallback})`,
      undefined,
      pawn.id,
    );
  }

  const jobId = job?.id ?? 'unknown';
  pawn.ai.currentJob = null;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};
  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;

  world.eventBuffer.push({
    type: 'job_interrupted',
    tick: world.tick,
    data: {
      pawnId: pawn.id,
      jobId,
      ...(reason ? { reason } : {}),
    },
  });

  log.info('ai', `Cleanup protocol executed for pawn ${pawn.id}, job ${jobId}`, undefined, pawn.id);
}
