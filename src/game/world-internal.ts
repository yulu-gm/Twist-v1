import type { WorldEntitySnapshot } from "./entity/entity-types";
import {
  deleteEntityOccupancy,
  findBlockingOccupant,
  writeEntityOccupancy
} from "./map/occupancy-manager";
import { isInsideGrid, type GridCoord, type WorldGridConfig } from "./map/world-grid";
import type { WorkItemKind, WorkItemSnapshot } from "./work/work-types";
import type { EntityDraft, WorldCore } from "./world-core-types";

export type SpawnOutcome =
  | Readonly<{ kind: "created" }>
  | Readonly<{ kind: "conflict"; blockingEntityId: string; blockingCell: GridCoord }>
  | Readonly<{ kind: "out-of-bounds"; cell: GridCoord }>;

export function cloneWorld(world: WorldCore): WorldCore {
  return {
    ...world,
    entities: new Map(world.entities),
    occupancy: new Map(world.occupancy),
    markers: new Map(world.markers),
    workItems: new Map(world.workItems),
    restSpots: [...world.restSpots]
  };
}

export function makeEntityId(world: WorldCore): string {
  return `entity-${world.nextEntityId}`;
}

export function normalizeOccupiedCells(draft: EntityDraft): readonly GridCoord[] {
  if (draft.occupiedCells !== undefined) {
    return [...draft.occupiedCells];
  }
  return [draft.cell];
}

export { findBlockingOccupant, writeEntityOccupancy, deleteEntityOccupancy } from "./map/occupancy-manager";

export function removeEntityMutable(world: WorldCore, entityId: string): WorldEntitySnapshot | undefined {
  const entity = world.entities.get(entityId);
  if (!entity) return undefined;
  deleteEntityOccupancy(world.occupancy, entityId, entity.occupiedCells);
  world.entities.delete(entityId);
  return entity;
}

export function upsertEntityMutable(world: WorldCore, entity: WorldEntitySnapshot): void {
  world.entities.set(entity.id, entity);
  writeEntityOccupancy(world.occupancy, entity.id, entity.occupiedCells);
}

export function withRelatedWorkItem(
  entity: WorldEntitySnapshot,
  workItemId: string
): WorldEntitySnapshot {
  if (entity.relatedWorkItemIds.includes(workItemId)) return entity;
  return {
    ...entity,
    relatedWorkItemIds: [...entity.relatedWorkItemIds, workItemId]
  };
}

export function createEntity(world: WorldCore, draft: EntityDraft): WorldEntitySnapshot {
  const entity: WorldEntitySnapshot = {
    id: makeEntityId(world),
    kind: draft.kind,
    cell: draft.cell,
    occupiedCells: normalizeOccupiedCells(draft),
    label: draft.label,
    buildingKind: draft.buildingKind,
    blueprintKind: draft.blueprintKind,
    buildProgress01: draft.buildProgress01,
    buildState: draft.buildState,
    relatedWorkItemIds: draft.relatedWorkItemIds ? [...draft.relatedWorkItemIds] : [],
    interactionCapabilities: draft.interactionCapabilities
      ? [...draft.interactionCapabilities]
      : undefined,
    ownership: draft.ownership,
    materialKind: draft.materialKind,
    containerKind: draft.containerKind,
    containerEntityId: draft.containerEntityId,
    pickupAllowed: draft.pickupAllowed,
    reservedByPawnId: draft.reservedByPawnId,
    loggingMarked: draft.loggingMarked,
    miningMarked: draft.miningMarked,
    zoneKind: draft.zoneKind,
    coveredCells: draft.coveredCells?.map((c) => ({ ...c })),
    acceptedMaterialKinds: draft.acceptedMaterialKinds
      ? [...draft.acceptedMaterialKinds]
      : undefined,
    carriedByPawnId: draft.carriedByPawnId
  };
  world.nextEntityId += 1;
  return entity;
}

export function firstInvalidCell(
  grid: WorldGridConfig,
  occupiedCells: readonly GridCoord[]
): GridCoord | undefined {
  return occupiedCells.find((cell) => !isInsideGrid(grid, cell));
}

export function spawnWorldEntity(
  world: WorldCore,
  draft: EntityDraft
): Readonly<{ world: WorldCore; entityId: string; outcome: SpawnOutcome }> {
  const nextWorld = cloneWorld(world);
  const occupiedCells = normalizeOccupiedCells(draft);
  const invalidCell = firstInvalidCell(nextWorld.grid, occupiedCells);
  if (invalidCell) {
    return {
      world,
      entityId: "",
      outcome: { kind: "out-of-bounds", cell: invalidCell }
    };
  }

  const blocking = findBlockingOccupant(nextWorld.occupancy, occupiedCells);
  if (blocking) {
    return {
      world,
      entityId: "",
      outcome: { kind: "conflict", ...blocking }
    };
  }

  const entity = createEntity(nextWorld, draft);
  upsertEntityMutable(nextWorld, entity);
  return {
    world: nextWorld,
    entityId: entity.id,
    outcome: { kind: "created" }
  };
}

export function makeWorkItemId(world: WorldCore): string {
  return `work-${world.nextWorkItemId}`;
}

export function findExistingWorkItem(
  world: WorldCore,
  kind: WorkItemKind,
  targetEntityId: string
): WorkItemSnapshot | undefined {
  for (const workItem of world.workItems.values()) {
    if (
      workItem.kind === kind &&
      workItem.targetEntityId === targetEntityId &&
      workItem.status !== "completed"
    ) {
      return workItem;
    }
  }
  return undefined;
}

export function attachWorkItemToEntityMutable(world: WorldCore, entityId: string, workItemId: string): void {
  const entity = world.entities.get(entityId);
  if (!entity) return;
  world.entities.set(entityId, withRelatedWorkItem(entity, workItemId));
}
