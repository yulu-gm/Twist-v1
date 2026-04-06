import {
  type TimeOfDayConfig,
  type TimeOfDayState,
  DEFAULT_TIME_CONTROL_STATE,
  DEFAULT_TIME_OF_DAY_CONFIG
} from "./time/time-of-day";
import { toWorldTimeSnapshot, type WorldTimeSnapshot } from "./time/world-time";

export type { TimePeriod, WorldTimeEvent, WorldTimeSnapshot } from "./time/world-time";
export { advanceWorldClock } from "./time/world-time";
import { createOccupancyMap } from "./map/occupancy-manager";
import { coordKey, type GridCoord, type WorldGridConfig } from "./map/world-grid";
import type {
  AssignmentReason,
  BuildState,
  BuildingKind,
  EntityOwnership,
  InteractionCapability,
  RestSpotSnapshot,
  WorldEntityKind,
  WorldEntitySnapshot
} from "./entity/entity-types";

export type {
  AssignmentReason,
  BuildState,
  BuildingKind,
  EntityOwnership,
  InteractionCapability,
  RestSpotSnapshot,
  WorldEntityKind,
  WorldEntitySnapshot
} from "./entity/entity-types";

import type { MarkerSnapshot, WorldCore, WorldSnapshot } from "./world-core-types";

export type { MarkerSnapshot, WorldCore, WorldSnapshot } from "./world-core-types";

import type { WorkItemKind } from "./work/work-types";

export type { WorkItemKind, WorkItemStatus, WorkItemSnapshot } from "./work/work-types";

export { claimWorkItem, completeWorkItem, failWorkItem } from "./work/work-operations";

import {
  attachWorkItemToEntityMutable,
  cloneWorld,
  findBlockingOccupant,
  findExistingWorkItem,
  firstInvalidCell,
  makeWorkItemId,
  removeEntityMutable,
  upsertEntityMutable
} from "./world-internal";

export { spawnWorldEntity } from "./world-internal";
export { placeBlueprint, safePlaceBlueprint } from "./building/blueprint-placement";

type CreateWorldCoreOptions = Readonly<{
  grid: WorldGridConfig;
  timeState?: TimeOfDayState;
  timeConfig?: TimeOfDayConfig;
}>;

type MoveOutcome =
  | Readonly<{ kind: "moved" }>
  | Readonly<{ kind: "missing-entity" }>
  | Readonly<{ kind: "conflict"; blockingEntityId: string; blockingCell: GridCoord }>
  | Readonly<{ kind: "out-of-bounds"; cell: GridCoord }>;

type RemoveOutcome = Readonly<{ kind: "removed" }> | Readonly<{ kind: "missing-entity" }>;

function shiftOccupiedCells(
  occupiedCells: readonly GridCoord[],
  fromCell: GridCoord,
  toCell: GridCoord
): readonly GridCoord[] {
  const deltaCol = toCell.col - fromCell.col;
  const deltaRow = toCell.row - fromCell.row;
  return occupiedCells.map((cell) => ({
    col: cell.col + deltaCol,
    row: cell.row + deltaRow
  }));
}

function makeMarkerId(world: WorldCore): string {
  return `marker-${world.nextMarkerId}`;
}

/** 深拷贝世界状态（回放基线、验收重绕等）。 */
export function cloneWorldCoreState(world: WorldCore): WorldCore {
  return cloneWorld(world);
}

export function createWorldCore(options: CreateWorldCoreOptions): WorldCore {
  const timeConfig = options.timeConfig ?? DEFAULT_TIME_OF_DAY_CONFIG;
  const timeState = options.timeState ?? {
    dayNumber: 1,
    minuteOfDay: timeConfig.startMinuteOfDay
  };

  return {
    grid: options.grid,
    time: toWorldTimeSnapshot(timeState, DEFAULT_TIME_CONTROL_STATE),
    timeConfig,
    entities: new Map(),
    occupancy: createOccupancyMap(),
    markers: new Map(),
    workItems: new Map(),
    restSpots: [],
    nextEntityId: 1,
    nextMarkerId: 1,
    nextWorkItemId: 1
  };
}

export function getWorldSnapshot(world: WorldCore): WorldSnapshot {
  const entities = [...world.entities.values()].map((entity) => ({
    ...entity,
    occupiedCells: entity.occupiedCells.map((cell) => ({ ...cell })),
    relatedWorkItemIds: [...entity.relatedWorkItemIds],
    interactionCapabilities: entity.interactionCapabilities
      ? [...entity.interactionCapabilities]
      : undefined,
    ownership: entity.ownership ? { ...entity.ownership } : undefined,
    coveredCells: entity.coveredCells?.map((cell) => ({ ...cell })),
    acceptedMaterialKinds: entity.acceptedMaterialKinds
      ? [...entity.acceptedMaterialKinds]
      : undefined,
    stackCount: entity.stackCount,
    stackable: entity.stackable,
    storageFilterMode: entity.storageFilterMode,
    storageGroupDisplayName: entity.storageGroupDisplayName,
    allowedMaterialKinds: entity.allowedMaterialKinds
      ? [...entity.allowedMaterialKinds]
      : undefined
  }));
  const markers = [...world.markers.values()].map((marker) => ({
    ...marker,
    cell: { ...marker.cell }
  }));
  const workItems = [...world.workItems.values()].map((workItem) => ({
    ...workItem,
    anchorCell: { ...workItem.anchorCell }
  }));
  const restSpots = world.restSpots.map((spot) => ({
    ...spot,
    cell: { ...spot.cell }
  }));

  return {
    time: { ...world.time },
    entities,
    occupancy: Object.fromEntries(world.occupancy),
    markers,
    workItems,
    restSpots
  };
}

export function moveWorldEntity(
  world: WorldCore,
  entityId: string,
  nextCell: GridCoord
): Readonly<{ world: WorldCore; outcome: MoveOutcome }> {
  const entity = world.entities.get(entityId);
  if (!entity) {
    return {
      world,
      outcome: { kind: "missing-entity" }
    };
  }

  const nextOccupiedCells = shiftOccupiedCells(entity.occupiedCells, entity.cell, nextCell);
  const invalidCell = firstInvalidCell(world.grid, nextOccupiedCells);
  if (invalidCell) {
    return {
      world,
      outcome: { kind: "out-of-bounds", cell: invalidCell }
    };
  }

  const blocking = findBlockingOccupant(world.occupancy, nextOccupiedCells, entityId);
  if (blocking) {
    return {
      world,
      outcome: { kind: "conflict", ...blocking }
    };
  }

  const nextWorld = cloneWorld(world);
  removeEntityMutable(nextWorld, entityId);
  upsertEntityMutable(nextWorld, {
    ...entity,
    cell: nextCell,
    occupiedCells: nextOccupiedCells
  });
  return {
    world: nextWorld,
    outcome: { kind: "moved" }
  };
}

export function removeWorldEntity(
  world: WorldCore,
  entityId: string
): Readonly<{ world: WorldCore; outcome: RemoveOutcome }> {
  if (!world.entities.has(entityId)) {
    return {
      world,
      outcome: { kind: "missing-entity" }
    };
  }

  const nextWorld = cloneWorld(world);
  removeEntityMutable(nextWorld, entityId);
  nextWorld.restSpots = nextWorld.restSpots.filter((spot) => spot.buildingEntityId !== entityId);
  return {
    world: nextWorld,
    outcome: { kind: "removed" }
  };
}

/**
 * 摘掉占住任意指定格的实体（含多格建筑整块移除）。供场景热载入等：在写入树人前保证目标 footprint 为空。
 */
export function removeWorldEntitiesOccupyingCells(
  world: WorldCore,
  cells: readonly GridCoord[]
): WorldCore {
  const ids = new Set<string>();
  for (const c of cells) {
    const id = world.occupancy.get(coordKey(c));
    if (id) ids.add(id);
  }
  let w = world;
  for (const id of ids) {
    const { world: next } = removeWorldEntity(w, id);
    w = next;
  }
  return w;
}

/**
 * 按格键清除玩家任务标记：移除对应 {@link MarkerSnapshot}，并对仅被这些标记引用的未领取工单做清理。
 */
export function clearTaskMarkersAtCells(
  world: WorldCore,
  cellKeys: ReadonlySet<string>
): WorldCore {
  const nextWorld = cloneWorld(world);
  const removedWorkIds = new Set<string>();
  for (const [markerId, marker] of nextWorld.markers) {
    if (!cellKeys.has(coordKey(marker.cell))) continue;
    nextWorld.markers.delete(markerId);
    removedWorkIds.add(marker.workItemId);
  }

  for (const workId of removedWorkIds) {
    const stillReferenced = [...nextWorld.markers.values()].some((m) => m.workItemId === workId);
    if (stillReferenced) continue;

    const work = nextWorld.workItems.get(workId);
    if (!work || work.status !== "open") continue;
    if (work.claimedBy) continue;

    nextWorld.workItems.delete(workId);
    if (work.targetEntityId) {
      const ent = nextWorld.entities.get(work.targetEntityId);
      if (ent) {
        nextWorld.entities.set(work.targetEntityId, {
          ...ent,
          relatedWorkItemIds: ent.relatedWorkItemIds.filter((id) => id !== workId)
        });
      }
    }
  }

  return nextWorld;
}

export function placeTaskMarker(
  world: WorldCore,
  input: Readonly<{
    kind: "deconstruct-obstacle";
    cell: GridCoord;
    targetEntityId: string;
  }>
): Readonly<{ world: WorldCore; markerId: string; workItemId: string }> {
  const nextWorld = cloneWorld(world);
  const existingWorkItem = findExistingWorkItem(nextWorld, "deconstruct-obstacle", input.targetEntityId);
  const workItemId = existingWorkItem?.id ?? makeWorkItemId(nextWorld);
  if (!existingWorkItem) {
    nextWorld.nextWorkItemId += 1;
    nextWorld.workItems.set(workItemId, {
      id: workItemId,
      kind: "deconstruct-obstacle",
      anchorCell: input.cell,
      targetEntityId: input.targetEntityId,
      status: "open",
      failureCount: 0
    });
  }

  attachWorkItemToEntityMutable(nextWorld, input.targetEntityId, workItemId);

  const markerId = makeMarkerId(nextWorld);
  nextWorld.nextMarkerId += 1;
  nextWorld.markers.set(markerId, {
    id: markerId,
    kind: input.kind,
    cell: input.cell,
    targetEntityId: input.targetEntityId,
    workItemId
  });

  return {
    world: nextWorld,
    markerId,
    workItemId
  };
}

/**
 * 标记树木为待伐并确保存在 {@link WorkItemKind} `chop-tree` 开放工单（与既有开放/认领单合并）。
 */
export function registerChopTreeWork(
  world: WorldCore,
  treeEntityId: string
): Readonly<{ world: WorldCore; workItemId: string }> {
  const entity = world.entities.get(treeEntityId);
  if (!entity || entity.kind !== "tree") {
    throw new Error(`registerChopTreeWork: 实体 ${treeEntityId} 不是树`);
  }

  const nextWorld = cloneWorld(world);
  const tree = nextWorld.entities.get(treeEntityId)!;
  nextWorld.entities.set(treeEntityId, { ...tree, loggingMarked: true });

  const existingWorkItem = findExistingWorkItem(nextWorld, "chop-tree", treeEntityId);
  const workItemId = existingWorkItem?.id ?? makeWorkItemId(nextWorld);
  if (!existingWorkItem) {
    nextWorld.nextWorkItemId += 1;
    nextWorld.workItems.set(workItemId, {
      id: workItemId,
      kind: "chop-tree",
      anchorCell: { ...tree.cell },
      targetEntityId: treeEntityId,
      status: "open",
      failureCount: 0
    });
  }

  attachWorkItemToEntityMutable(nextWorld, treeEntityId, workItemId);
  return { world: nextWorld, workItemId };
}

/**
 * 标记地图石料为待开采并确保存在 {@link WorkItemKind} `mine-stone` 开放工单（与既有开放/认领单合并）。
 */
export function registerMineStoneWork(
  world: WorldCore,
  stoneObstacleEntityId: string
): Readonly<{ world: WorldCore; workItemId: string }> {
  const entity = world.entities.get(stoneObstacleEntityId);
  if (!entity || entity.kind !== "obstacle" || entity.label !== "stone") {
    throw new Error(`registerMineStoneWork: 实体 ${stoneObstacleEntityId} 不是石料障碍`);
  }

  const nextWorld = cloneWorld(world);
  const stone = nextWorld.entities.get(stoneObstacleEntityId)!;
  nextWorld.entities.set(stoneObstacleEntityId, { ...stone, miningMarked: true });

  const existingWorkItem = findExistingWorkItem(nextWorld, "mine-stone", stoneObstacleEntityId);
  const workItemId = existingWorkItem?.id ?? makeWorkItemId(nextWorld);
  if (!existingWorkItem) {
    nextWorld.nextWorkItemId += 1;
    nextWorld.workItems.set(workItemId, {
      id: workItemId,
      kind: "mine-stone",
      anchorCell: { ...stone.cell },
      targetEntityId: stoneObstacleEntityId,
      status: "open",
      failureCount: 0
    });
  }

  attachWorkItemToEntityMutable(nextWorld, stoneObstacleEntityId, workItemId);
  return { world: nextWorld, workItemId };
}

/**
 * 将地面物资标为可拾取并确保存在 {@link WorkItemKind} `pick-up-resource` 开放工单（与既有开放/认领单合并）。
 */
export function registerPickUpResourceWork(
  world: WorldCore,
  resourceEntityId: string
): Readonly<{ world: WorldCore; workItemId: string }> {
  const entity = world.entities.get(resourceEntityId);
  if (!entity || entity.kind !== "resource") {
    throw new Error(`registerPickUpResourceWork: 实体 ${resourceEntityId} 不是物资`);
  }
  if (entity.containerKind !== "ground") {
    throw new Error(`registerPickUpResourceWork: 物资 ${resourceEntityId} 不在地面`);
  }

  const nextWorld = cloneWorld(world);
  const resource = nextWorld.entities.get(resourceEntityId)!;
  nextWorld.entities.set(resourceEntityId, { ...resource, pickupAllowed: true });

  const existingWorkItem = findExistingWorkItem(nextWorld, "pick-up-resource", resourceEntityId);
  const workItemId = existingWorkItem?.id ?? makeWorkItemId(nextWorld);
  if (!existingWorkItem) {
    nextWorld.nextWorkItemId += 1;
    nextWorld.workItems.set(workItemId, {
      id: workItemId,
      kind: "pick-up-resource",
      anchorCell: { ...resource.cell },
      targetEntityId: resourceEntityId,
      status: "open",
      failureCount: 0
    });
  }

  attachWorkItemToEntityMutable(nextWorld, resourceEntityId, workItemId);
  return { world: nextWorld, workItemId };
}
