import {
  ObjectKind, TickPhase, ToilType, ToilState, JobState, cellEquals, ObjectId, nextObjectId,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import { findPath } from '../pathfinding/path.service';
import { cleanupProtocol } from './cleanup';
import { Job, Toil } from './ai.types';
import { ConstructionSite } from '../construction/construction-site.types';

/**
 * Duck-typed Pawn shape for the toil executor.
 */
interface ExecutablePawn {
  id: ObjectId;
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
    carrying: ObjectId | null;
    carryCapacity: number;
  };
  needs: {
    food: number;
    rest: number;
  };
}

export const toilExecutorSystem: SystemRegistration = {
  id: 'toilExecutor',
  phase: TickPhase.EXECUTION,
  frequency: 1,
  execute(world: World) {
    for (const [, map] of world.maps) {
      processMap(world, map);
    }
  },
};

function processMap(world: World, map: GameMap): void {
  const pawns = map.objects.allOfKind(ObjectKind.Pawn) as unknown as ExecutablePawn[];

  for (const pawn of pawns) {
    const job = pawn.ai.currentJob;
    if (!job) continue;
    if (job.state === JobState.Done || job.state === JobState.Failed) continue;

    // ── Section 8.7: Mid-job interrupt triggers ──
    // Need urgency: food < 10 interrupts current non-eating job
    if (pawn.needs.food < 10 && job.defId !== 'job_eat') {
      log.info('ai', `Pawn ${pawn.id} interrupted (food critical: ${Math.floor(pawn.needs.food)})`, undefined, pawn.id);
      cleanupProtocol(pawn as any, map, world);
      continue;
    }

    // Target destroyed check
    if (job.targetId) {
      const target = map.objects.get(job.targetId);
      if (target && target.destroyed) {
        log.info('ai', `Pawn ${pawn.id} interrupted (target ${job.targetId} destroyed)`, undefined, pawn.id);
        cleanupProtocol(pawn as any, map, world);
        continue;
      }
    }

    // Mark as active
    if (job.state === JobState.Starting) {
      job.state = JobState.Active;
    }

    const toilIndex = job.currentToilIndex;
    if (toilIndex >= job.toils.length) {
      // All toils complete
      completeJob(pawn, map, world);
      continue;
    }

    const toil = job.toils[toilIndex];

    if (toil.state === ToilState.NotStarted) {
      toil.state = ToilState.InProgress;
    }

    if (toil.state === ToilState.Completed) {
      advanceToil(pawn, job, world);
      continue;
    }

    if (toil.state === ToilState.Failed) {
      log.warn('ai', `Toil failed for pawn ${pawn.id}, triggering cleanup`, undefined, pawn.id);
      cleanupProtocol(pawn as any, map, world);
      continue;
    }

    // Execute the toil
    executeToil(pawn, toil, job, map, world);
  }
}

function executeToil(
  pawn: ExecutablePawn,
  toil: Toil,
  job: Job,
  map: GameMap,
  world: World,
): void {
  switch (toil.type) {
    case ToilType.GoTo:
      executeGoTo(pawn, toil, map, world);
      break;
    case ToilType.PickUp:
      executePickUp(pawn, toil, map, world);
      break;
    case ToilType.Drop:
      executeDrop(pawn, toil, map, world);
      break;
    case ToilType.Work:
      executeWork(pawn, toil, job, map, world);
      break;
    case ToilType.Wait:
      executeWait(pawn, toil);
      break;
    case ToilType.Deliver:
      executeDeliver(pawn, toil, map, world);
      break;
    case ToilType.Interact:
      executeInteract(pawn, toil, map, world);
      break;
    default:
      log.warn('ai', `Unknown toil type: ${toil.type}`, undefined, pawn.id);
      toil.state = ToilState.Failed;
      break;
  }
}

function executeGoTo(
  pawn: ExecutablePawn,
  toil: Toil,
  map: GameMap,
  world: World,
): void {
  const target = toil.targetCell;
  if (!target) {
    log.warn('ai', `GoTo toil has no targetCell for pawn ${pawn.id}`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  // Check if already arrived
  if (cellEquals(pawn.cell, target)) {
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} arrived at (${target.x},${target.y})`, undefined, pawn.id);
    return;
  }

  // If no path set, find one
  if (!pawn.movement.path || pawn.movement.path.length === 0) {
    const result = findPath(map, pawn.cell, target);
    if (!result.found) {
      log.warn('ai', `Pawn ${pawn.id} cannot find path to (${target.x},${target.y})`, undefined, pawn.id);
      toil.state = ToilState.Failed;
      return;
    }
    pawn.movement.path = result.path;
    pawn.movement.pathIndex = 0;
    pawn.movement.moveProgress = 0;
    log.debug('ai', `Pawn ${pawn.id} pathing to (${target.x},${target.y}), ${result.path.length} steps`, undefined, pawn.id);
  }

  // Movement system handles the actual movement.
  // We just check if we've arrived.
  if (cellEquals(pawn.cell, target)) {
    toil.state = ToilState.Completed;
    pawn.movement.path = [];
    pawn.movement.pathIndex = 0;
    pawn.movement.moveProgress = 0;
  }
}

function executePickUp(
  pawn: ExecutablePawn,
  toil: Toil,
  map: GameMap,
  _world: World,
): void {
  const targetId = toil.targetId;
  if (!targetId) {
    toil.state = ToilState.Failed;
    return;
  }

  const item = map.objects.get(targetId) as any;
  if (!item || item.destroyed) {
    log.warn('ai', `Pawn ${pawn.id} PickUp target ${targetId} not found`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  // Check pawn is at item location
  if (!cellEquals(pawn.cell, item.cell)) {
    log.warn('ai', `Pawn ${pawn.id} not at item ${targetId} location for pickup`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  // Stash item info for later Drop/Deliver toils
  toil.localData.pickedDefId = item.defId;
  toil.localData.pickedCount = item.stackCount ?? 1;

  // Pick up: store ObjectId reference, remove item from pool
  pawn.inventory.carrying = targetId;
  map.objects.remove(targetId);

  // Propagate item info to subsequent Drop/Deliver toils in the job
  const job = pawn.ai.currentJob;
  if (job) {
    for (let i = job.currentToilIndex + 1; i < job.toils.length; i++) {
      const nextToil = job.toils[i];
      if (nextToil.type === ToilType.Drop || nextToil.type === ToilType.Deliver) {
        nextToil.localData.defId = item.defId;
        nextToil.localData.count = item.stackCount ?? 1;
      }
    }
  }

  log.debug('ai', `Pawn ${pawn.id} picked up ${item.defId} (${targetId})`, undefined, pawn.id);
  toil.state = ToilState.Completed;
}

function executeDrop(
  pawn: ExecutablePawn,
  toil: Toil,
  map: GameMap,
  _world: World,
): void {
  if (!pawn.inventory.carrying) {
    log.warn('ai', `Pawn ${pawn.id} has nothing to drop`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  const carriedId = pawn.inventory.carrying;

  // Re-create the item at pawn's current cell (item was removed from pool on pickup)
  // We use toil.localData to carry defId/count info stashed during pickup,
  // or fall back to creating a generic item.
  const defId = (toil.localData.defId as string) ?? 'unknown';
  const count = (toil.localData.count as number) ?? 1;

  const item = {
    id: nextObjectId(),
    kind: ObjectKind.Item,
    defId,
    mapId: map.id,
    cell: { x: pawn.cell.x, y: pawn.cell.y },
    tags: new Set(['haulable', 'resource']),
    destroyed: false,
    stackCount: count,
    maxStack: 100,
  };

  map.objects.add(item as any);
  pawn.inventory.carrying = null;

  log.debug('ai', `Pawn ${pawn.id} dropped ${defId} x${count} at (${pawn.cell.x},${pawn.cell.y})`, undefined, pawn.id);
  toil.state = ToilState.Completed;
}

function executeWork(
  pawn: ExecutablePawn,
  toil: Toil,
  job: Job,
  map: GameMap,
  world: World,
): void {
  const ld = toil.localData;
  const workDone = (ld.workDone as number) ?? 0;
  const totalWork = (ld.totalWork as number) ?? 100;

  ld.workDone = workDone + 1;

  // If working on a construction site, update its progress
  if (toil.targetId) {
    const target = map.objects.get(toil.targetId) as any;
    if (target && target.kind === ObjectKind.ConstructionSite) {
      const site = target as ConstructionSite;
      site.workDone += 1;
      site.buildProgress = site.workDone / site.totalWorkAmount;
    }
  }

  if ((ld.workDone as number) >= totalWork) {
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} finished work toil (${totalWork} work)`, undefined, pawn.id);

    if (toil.targetId) {
      const target = map.objects.get(toil.targetId);
      if (target) {
        // Designation-related work: destroy the designation
        if (target.kind === ObjectKind.Designation) {
          const desig = target as any;

          // Mine designation: change terrain and yield stone
          if (desig.designationType === 'mine' && desig.targetCell) {
            const tc = desig.targetCell;
            const terrainDefId = map.terrain.get(tc.x, tc.y);
            const terrainDef = world.defs.terrains.get(terrainDefId);
            if (terrainDef?.mineable) {
              // Change terrain to floor
              map.terrain.set(tc.x, tc.y, 'dirt');
              map.pathGrid.setPassable(tc.x, tc.y, true);

              // Yield items from mining
              if (terrainDef.mineYield) {
                const yieldItem = {
                  id: nextObjectId(),
                  kind: ObjectKind.Item,
                  defId: terrainDef.mineYield.defId,
                  mapId: map.id,
                  cell: { x: tc.x, y: tc.y },
                  tags: new Set(['haulable', 'resource']),
                  destroyed: false,
                  stackCount: terrainDef.mineYield.count,
                  maxStack: 100,
                };
                map.objects.add(yieldItem as any);
              }
            }
          }

          // Harvest designation: destroy plant and yield
          if ((desig.designationType === 'harvest' || desig.designationType === 'cut') && desig.targetObjectId) {
            const plant = map.objects.get(desig.targetObjectId);
            if (plant && plant.kind === ObjectKind.Plant) {
              const plantDef = world.defs.plants.get(plant.defId);
              if (plantDef?.harvestYield) {
                const yieldItem = {
                  id: nextObjectId(),
                  kind: ObjectKind.Item,
                  defId: plantDef.harvestYield.defId,
                  mapId: map.id,
                  cell: { x: plant.cell.x, y: plant.cell.y },
                  tags: new Set(['haulable', 'resource']),
                  destroyed: false,
                  stackCount: plantDef.harvestYield.count,
                  maxStack: 100,
                };
                map.objects.add(yieldItem as any);
              }
              plant.destroyed = true;
            }
          }

          target.destroyed = true;
          map.objects.remove(toil.targetId);
          world.eventBuffer.push({
            type: 'designation_completed',
            tick: world.tick,
            data: { designationId: toil.targetId, pawnId: pawn.id },
          });
        }
      }
    }
  }
}

function executeWait(
  pawn: ExecutablePawn,
  toil: Toil,
): void {
  const ld = toil.localData;
  const waited = (ld.waited as number) ?? 0;
  const waitTicks = (ld.waitTicks as number) ?? 60;

  ld.waited = waited + 1;

  if ((ld.waited as number) >= waitTicks) {
    // If this wait is part of eating, restore food
    if (ld.eating) {
      pawn.needs.food = Math.min(100, pawn.needs.food + (ld.nutritionValue as number ?? 30));
      log.debug('ai', `Pawn ${pawn.id} finished eating, food: ${Math.floor(pawn.needs.food)}`, undefined, pawn.id);
    }
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} finished waiting (${waitTicks} ticks)`, undefined, pawn.id);
  }
}

/**
 * Deliver: Go to target, then drop carried item at target location.
 * Combines GoTo + Drop in a single toil for hauling materials to blueprints.
 */
function executeDeliver(
  pawn: ExecutablePawn,
  toil: Toil,
  map: GameMap,
  world: World,
): void {
  const target = toil.targetCell;
  if (!target) {
    toil.state = ToilState.Failed;
    return;
  }

  // Phase 1: Move to target
  if (!cellEquals(pawn.cell, target)) {
    if (!pawn.movement.path || pawn.movement.path.length === 0) {
      const result = findPath(map, pawn.cell, target);
      if (!result.found) {
        toil.state = ToilState.Failed;
        return;
      }
      pawn.movement.path = result.path;
      pawn.movement.pathIndex = 0;
      pawn.movement.moveProgress = 0;
    }
    return; // Wait for movement system to move us
  }

  // Phase 2: Deliver item at target
  if (!pawn.inventory.carrying) {
    toil.state = ToilState.Completed;
    return;
  }

  const carriedId = pawn.inventory.carrying;
  const defId = (toil.localData.defId as string) ?? 'unknown';
  const count = (toil.localData.count as number) ?? 1;

  // If delivering to a blueprint, update its materialsDelivered
  if (toil.targetId) {
    const blueprint = map.objects.get(toil.targetId) as any;
    if (blueprint && blueprint.kind === ObjectKind.Blueprint && blueprint.materialsDelivered) {
      for (const mat of blueprint.materialsDelivered) {
        if (mat.defId === defId) {
          mat.count += count;
          break;
        }
      }
    }
  } else {
    // Just drop on ground
    const item = {
      id: nextObjectId(),
      kind: ObjectKind.Item,
      defId,
      mapId: map.id,
      cell: { x: pawn.cell.x, y: pawn.cell.y },
      tags: new Set(['haulable', 'resource']),
      destroyed: false,
      stackCount: count,
      maxStack: 100,
    };
    map.objects.add(item as any);
  }

  pawn.inventory.carrying = null;
  toil.state = ToilState.Completed;
  log.debug('ai', `Pawn ${pawn.id} delivered ${defId} x${count}`, undefined, pawn.id);
}

/**
 * Interact: Use a building (workstation, bed, etc).
 * Pawn must be at the interaction cell. Runs for a set number of ticks.
 */
function executeInteract(
  pawn: ExecutablePawn,
  toil: Toil,
  map: GameMap,
  _world: World,
): void {
  if (!toil.targetId) {
    toil.state = ToilState.Failed;
    return;
  }

  const building = map.objects.get(toil.targetId) as any;
  if (!building || building.destroyed) {
    toil.state = ToilState.Failed;
    return;
  }

  // Check pawn is at interaction cell
  const interactionCell = building.interaction?.interactionCell ?? building.cell;
  if (!cellEquals(pawn.cell, interactionCell)) {
    toil.state = ToilState.Failed;
    return;
  }

  const ld = toil.localData;
  const interacted = (ld.interacted as number) ?? 0;
  const interactTicks = (ld.interactTicks as number) ?? 30;

  ld.interacted = interacted + 1;

  if ((ld.interacted as number) >= interactTicks) {
    toil.state = ToilState.Completed;
    log.debug('ai', `Pawn ${pawn.id} finished interacting with ${building.defId}`, undefined, pawn.id);
  }
}

function advanceToil(pawn: ExecutablePawn, job: Job, world: World): void {
  job.currentToilIndex++;
  pawn.ai.currentToilIndex = job.currentToilIndex;

  if (job.currentToilIndex >= job.toils.length) {
    completeJob(pawn, null, world);
  }
}

function completeJob(pawn: ExecutablePawn, map: GameMap | null, world: World): void {
  const job = pawn.ai.currentJob;
  if (!job) return;

  job.state = JobState.Done;

  // Release reservations
  if (map) {
    for (const resId of job.reservations) {
      map.reservations.release(resId);
    }
  }

  log.info('ai', `Pawn ${pawn.id} completed job ${job.id} (${job.defId})`, undefined, pawn.id);

  world.eventBuffer.push({
    type: 'job_completed',
    tick: world.tick,
    data: { pawnId: pawn.id, jobId: job.id, defId: job.defId },
  });

  // Reset pawn AI state
  pawn.ai.currentJob = null;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};
  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;
}
