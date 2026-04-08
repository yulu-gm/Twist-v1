import {
  ObjectKind, TickPhase, DesignationType, CellCoord, ToilType, ToilState, JobState,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import { estimateDistance } from '../pathfinding/path.service';
import { Job, JobCandidate } from './ai.types';
import { Blueprint } from '../construction/blueprint.types';
import { ConstructionSite } from '../construction/construction-site.types';
import { createMineJob } from './jobs/mine-job';
import { createHarvestJob } from './jobs/harvest-job';
import { createConstructJob } from './jobs/construct-job';
import { createHaulJob } from './jobs/haul-job';
import { createEatJob } from './jobs/eat-job';

/**
 * Duck-typed Pawn shape for job selection.
 */
interface SelectablePawn {
  id: string;
  kind: ObjectKind;
  cell: { x: number; y: number };
  ai: {
    currentJob: Job | null;
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
    carrying: string | null;
    carryCapacity: number;
  };
  needs: {
    food: number;
    rest: number;
  };
}

/**
 * Duck-typed Designation shape.
 */
interface DesignationObj {
  id: string;
  kind: ObjectKind;
  cell: { x: number; y: number };
  destroyed: boolean;
  designationType: string;
  targetObjectId?: string;
  targetCell?: CellCoord;
  priority?: number;
}

let wanderJobCounter = 0;

export const jobSelectionSystem: SystemRegistration = {
  id: 'jobSelection',
  phase: TickPhase.AI_DECISION,
  frequency: 1,
  execute(world: World) {
    for (const [, map] of world.maps) {
      processMap(world, map);
    }
  },
};

function processMap(world: World, map: GameMap): void {
  const pawns = map.objects.allOfKind(ObjectKind.Pawn) as unknown as SelectablePawn[];

  for (const pawn of pawns) {
    // Only assign jobs to idle pawns
    if (pawn.ai.currentJob !== null) continue;

    pawn.ai.idleTicks++;

    const candidates = gatherCandidates(pawn, map, world);

    if (candidates.length === 0) {
      // Default: wander (only after some idle ticks)
      if (pawn.ai.idleTicks > 30) {
        const wanderJob = createWanderJob(pawn, map, world);
        if (wanderJob) {
          assignJob(pawn, wanderJob, map, world);
        }
      }
      continue;
    }

    // Sort by score descending, pick best
    candidates.sort((a, b) => b.score - a.score);

    // Try to assign best available job, attempting reservation
    let assigned = false;
    for (const candidate of candidates) {
      if (candidate.job.targetId) {
        const resId = map.reservations.tryReserve({
          claimantId: pawn.id,
          targetId: candidate.job.targetId,
          jobId: candidate.job.id,
          currentTick: world.tick,
        });

        if (resId === null) continue; // already reserved, try next

        candidate.job.reservations.push(resId);
      }

      assignJob(pawn, candidate.job, map, world);
      assigned = true;
      break;
    }

    if (!assigned) {
      const wanderJob = createWanderJob(pawn, map, world);
      if (wanderJob) {
        assignJob(pawn, wanderJob, map, world);
      }
    }
  }
}

function gatherCandidates(
  pawn: SelectablePawn,
  map: GameMap,
  _world: World,
): JobCandidate[] {
  const candidates: JobCandidate[] = [];

  // ── 1. Check urgent needs ──
  // Food need: if food < 30, find food
  if (pawn.needs.food < 30) {
    const foodCandidate = findFoodJob(pawn, map);
    if (foodCandidate) {
      candidates.push(foodCandidate);
    }
  }

  // ── 2. Check designations (mine, harvest, cut) ──
  const designations = map.objects.allOfKind(ObjectKind.Designation) as unknown as DesignationObj[];
  for (const desig of designations) {
    if (desig.destroyed) continue;
    if (map.reservations.isReserved(desig.id)) continue;

    const targetCell = desig.targetCell ?? desig.cell;
    const dist = estimateDistance(pawn.cell, targetCell);
    const priorityBonus = (desig.priority ?? 2) * 10;

    let job: Job | null = null;
    let baseScore = 50;

    switch (desig.designationType) {
      case DesignationType.Mine:
        job = createMineJob(pawn.id, targetCell, desig.id, map);
        baseScore = 60;
        break;
      case DesignationType.Harvest:
      case DesignationType.Cut:
        job = createHarvestJob(pawn.id, desig.id, targetCell);
        baseScore = 50;
        break;
    }

    if (job) {
      const score = baseScore + priorityBonus - dist * 0.5;
      candidates.push({ job, score });
    }
  }

  // ── 3. Check blueprints needing material delivery ──
  const blueprints = map.objects.allOfKind(ObjectKind.Blueprint) as unknown as Blueprint[];
  for (const bp of blueprints) {
    if (bp.destroyed) continue;

    // Find which materials still need delivery
    for (let i = 0; i < bp.materialsRequired.length; i++) {
      const needed = bp.materialsRequired[i].count - (bp.materialsDelivered[i]?.count ?? 0);
      if (needed <= 0) continue;

      const matDefId = bp.materialsRequired[i].defId;

      // Find nearest item of this def
      const items = map.objects.allOfKind(ObjectKind.Item);
      let bestItem: any = null;
      let bestItemDist = Infinity;

      for (const item of items) {
        if (item.destroyed) continue;
        if (item.defId !== matDefId) continue;
        if (map.reservations.isReserved(item.id)) continue;

        const d = estimateDistance(pawn.cell, item.cell);
        if (d < bestItemDist) {
          bestItemDist = d;
          bestItem = item;
        }
      }

      if (bestItem) {
        const job = createHaulJob(pawn.id, bestItem.id, bestItem.cell, bp.cell, bp.id);
        const score = 45 - bestItemDist * 0.5;
        candidates.push({ job, score });
        break; // only one haul job per blueprint per pawn
      }
    }
  }

  // ── 4. Check construction sites needing work ──
  const sites = map.objects.allOfKind(ObjectKind.ConstructionSite) as unknown as ConstructionSite[];
  for (const site of sites) {
    if (site.destroyed) continue;
    if (site.buildProgress >= 1.0) continue;
    if (map.reservations.isReserved(site.id)) continue;

    const dist = estimateDistance(pawn.cell, site.cell);
    const job = createConstructJob(pawn.id, site.id, site.cell);

    // Update work toil totalWork from site
    const workToil = job.toils.find(t => t.type === ToilType.Work);
    if (workToil) {
      workToil.localData.totalWork = site.totalWorkAmount - site.workDone;
    }

    const score = 40 - dist * 0.5;
    candidates.push({ job, score });
  }

  return candidates;
}

function findFoodJob(
  pawn: SelectablePawn,
  map: GameMap,
): JobCandidate | null {
  const items = map.objects.allWithTag('food');
  let bestItem: any = null;
  let bestDist = Infinity;

  for (const item of items) {
    if (item.destroyed) continue;
    if (map.reservations.isReserved(item.id)) continue;

    const dist = estimateDistance(pawn.cell, item.cell);
    if (dist < bestDist) {
      bestDist = dist;
      bestItem = item;
    }
  }

  if (!bestItem) return null;

  const job = createEatJob(pawn.id, bestItem.id, bestItem.cell);
  // High priority for urgent needs
  const urgency = (30 - pawn.needs.food) / 30; // 0 to 1, higher = more urgent
  const score = 100 + urgency * 200 - bestDist * 0.5;

  return { job, score };
}

function createWanderJob(
  pawn: SelectablePawn,
  map: GameMap,
  world: World,
): Job | null {
  // Pick a random passable cell within a small radius
  const radius = 5;
  const attempts = 10;

  for (let i = 0; i < attempts; i++) {
    const dx = world.rng.nextInt(-radius, radius);
    const dy = world.rng.nextInt(-radius, radius);
    const target: CellCoord = {
      x: Math.max(0, Math.min(map.width - 1, pawn.cell.x + dx)),
      y: Math.max(0, Math.min(map.height - 1, pawn.cell.y + dy)),
    };

    if (!map.pathGrid.isPassable(target.x, target.y)) continue;
    if (!map.spatial.isPassable(target)) continue;

    wanderJobCounter++;
    const job: Job = {
      id: `job_wander_${wanderJobCounter}`,
      defId: 'job_wander',
      pawnId: pawn.id,
      targetCell: target,
      toils: [
        {
          type: ToilType.GoTo,
          targetCell: target,
          state: ToilState.NotStarted,
          localData: {},
        },
      ],
      currentToilIndex: 0,
      reservations: [],
      state: JobState.Starting,
    };

    return job;
  }

  return null;
}

function assignJob(
  pawn: SelectablePawn,
  job: Job,
  _map: GameMap,
  world: World,
): void {
  pawn.ai.currentJob = job;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};
  pawn.ai.idleTicks = 0;

  log.info('ai', `Pawn ${pawn.id} assigned job ${job.id} (${job.defId})`, undefined, pawn.id);

  world.eventBuffer.push({
    type: 'job_assigned',
    tick: world.tick,
    data: { pawnId: pawn.id, jobId: job.id, defId: job.defId },
  });
}
