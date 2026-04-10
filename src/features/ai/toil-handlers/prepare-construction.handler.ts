import {
  ObjectKind, ToilType, ToilState,
} from '../../../core/types';
import { log } from '../../../core/logger';
import type { GameMap } from '../../../world/game-map';
import type { Job } from '../ai.types';
import type { ConstructionSite } from '../../construction/construction-site.types';
import type { ToilHandler } from './toil-handler.types';
import {
  findConstructionSiteAtCell,
  tryPromoteBlueprintToConstructionSite,
} from '../../construction/construction.helpers';

function retargetConstructionJob(
  map: GameMap,
  pawnId: string,
  worldTick: number,
  job: Job,
  site: ConstructionSite,
): boolean {
  for (const reservationId of [...job.reservations]) {
    map.reservations.release(reservationId);
  }
  job.reservations = [];

  const siteReservationId = map.reservations.tryReserve({
    claimantId: pawnId,
    targetId: site.id,
    jobId: job.id,
    currentTick: worldTick,
  });
  if (siteReservationId === null) {
    return false;
  }

  job.reservations.push(siteReservationId);
  job.targetId = site.id;
  job.targetCell = site.cell;

  for (const toil of job.toils) {
    if (toil.type !== ToilType.Work) continue;
    toil.targetId = site.id;
    toil.targetCell = site.cell;
    toil.localData.workDone = 0;
    toil.localData.totalWork = Math.max(0, site.totalWorkAmount - site.workDone);
  }

  return true;
}

export const executePrepareConstruction: ToilHandler = ({
  pawn, toil, job, map, world,
}) => {
  if (!toil.targetId || !toil.targetCell) {
    toil.state = ToilState.Failed;
    return;
  }

  const existingSite = map.objects.getAs(toil.targetId, ObjectKind.ConstructionSite)
    ?? findConstructionSiteAtCell(map, toil.targetCell);
  if (existingSite) {
    if (!retargetConstructionJob(map, pawn.id, world.tick, job, existingSite)) {
      toil.state = ToilState.Failed;
      return;
    }
    toil.state = ToilState.Completed;
    return;
  }

  const result = tryPromoteBlueprintToConstructionSite(world, map, toil.targetId);
  if (!result.promoted || !result.site) {
    log.debug('construction', `Prepare construction failed for ${toil.targetId}`, { reason: result.reason }, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  if (!retargetConstructionJob(map, pawn.id, world.tick, job, result.site)) {
    toil.state = ToilState.Failed;
    return;
  }

  toil.state = ToilState.Completed;
};
