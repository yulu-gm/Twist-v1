import {
  attachWorkItemToEntityMutable,
  cloneWorld,
  createEntity,
  deleteEntityOccupancy,
  findBlockingOccupant,
  makeWorkItemId,
  removeEntityMutable,
  upsertEntityMutable
} from "../world-internal";
import { coordKey, type GridCoord } from "../map/world-grid";
import type { WorldEntitySnapshot } from "../entity/entity-types";
import type { WorldCore } from "../world-core-types";
import type { WorkItemSnapshot } from "./work-types";

export type ClaimOutcome =
  | Readonly<{ kind: "claimed" }>
  | Readonly<{ kind: "missing-work-item" }>
  | Readonly<{ kind: "already-claimed"; claimedBy: string }>;

export type FailOutcome =
  | Readonly<{ kind: "failed"; reason: string }>
  | Readonly<{ kind: "missing-work-item" }>
  | Readonly<{ kind: "not-claim-owner"; claimedBy?: string }>;

export type CompleteOutcome =
  | Readonly<{ kind: "completed"; createdEntityId?: string }>
  | Readonly<{ kind: "missing-work-item" }>
  | Readonly<{ kind: "not-claim-owner"; claimedBy?: string }>
  | Readonly<{ kind: "target-missing" }>
  | Readonly<{ kind: "conflict"; blockingEntityId: string; blockingCell: GridCoord }>;

function markWorkClaimedState(workItem: WorkItemSnapshot, pawnId: string): WorkItemSnapshot {
  return {
    ...workItem,
    status: "claimed",
    claimedBy: pawnId
  };
}

export function claimWorkItem(
  world: WorldCore,
  workItemId: string,
  pawnId: string
): Readonly<{ world: WorldCore; outcome: ClaimOutcome }> {
  const workItem = world.workItems.get(workItemId);
  if (!workItem) {
    return {
      world,
      outcome: { kind: "missing-work-item" }
    };
  }

  if (workItem.claimedBy && workItem.claimedBy !== pawnId) {
    return {
      world,
      outcome: { kind: "already-claimed", claimedBy: workItem.claimedBy }
    };
  }

  const nextWorld = cloneWorld(world);
  nextWorld.workItems.set(workItemId, markWorkClaimedState(workItem, pawnId));

  if (workItem.targetEntityId) {
    const targetEntity = nextWorld.entities.get(workItem.targetEntityId);
    if (targetEntity?.kind === "blueprint") {
      nextWorld.entities.set(workItem.targetEntityId, {
        ...targetEntity,
        buildState: "in-progress"
      });
    }
  }

  return {
    world: nextWorld,
    outcome: { kind: "claimed" }
  };
}

export function failWorkItem(
  world: WorldCore,
  workItemId: string,
  pawnId: string,
  reason: string
): Readonly<{ world: WorldCore; outcome: FailOutcome }> {
  const workItem = world.workItems.get(workItemId);
  if (!workItem) {
    return {
      world,
      outcome: { kind: "missing-work-item" }
    };
  }

  if (workItem.claimedBy !== pawnId) {
    return {
      world,
      outcome: { kind: "not-claim-owner", claimedBy: workItem.claimedBy }
    };
  }

  const nextWorld = cloneWorld(world);
  nextWorld.workItems.set(workItemId, {
    ...workItem,
    status: "open",
    claimedBy: undefined,
    failureCount: workItem.failureCount + 1
  });

  if (workItem.targetEntityId) {
    const targetEntity = nextWorld.entities.get(workItem.targetEntityId);
    if (targetEntity?.kind === "blueprint") {
      nextWorld.entities.set(workItem.targetEntityId, {
        ...targetEntity,
        buildState: "planned"
      });
    }
  }

  return {
    world: nextWorld,
    outcome: { kind: "failed", reason }
  };
}

export function completeDeconstructWork(
  world: WorldCore,
  workItem: WorkItemSnapshot
): Readonly<{ world: WorldCore; outcome: CompleteOutcome }> {
  if (!workItem.targetEntityId || !world.entities.has(workItem.targetEntityId)) {
    return {
      world,
      outcome: { kind: "target-missing" }
    };
  }

  const nextWorld = cloneWorld(world);
  removeEntityMutable(nextWorld, workItem.targetEntityId);
  nextWorld.workItems.set(workItem.id, {
    ...workItem,
    status: "completed",
    claimedBy: workItem.claimedBy
  });
  for (const [markerId, marker] of nextWorld.markers) {
    if (marker.workItemId === workItem.id) {
      nextWorld.markers.delete(markerId);
    }
  }
  return {
    world: nextWorld,
    outcome: { kind: "completed" }
  };
}

export function completeBlueprintWork(
  world: WorldCore,
  workItem: WorkItemSnapshot
): Readonly<{ world: WorldCore; outcome: CompleteOutcome }> {
  const blueprint = workItem.targetEntityId ? world.entities.get(workItem.targetEntityId) : undefined;
  if (!blueprint) {
    return {
      world,
      outcome: { kind: "target-missing" }
    };
  }

  const nextWorld = cloneWorld(world);
  removeEntityMutable(nextWorld, blueprint.id);
  const blocking = findBlockingOccupant(nextWorld.occupancy, blueprint.occupiedCells);
  if (blocking) {
    return {
      world,
      outcome: { kind: "conflict", ...blocking }
    };
  }

  const building = createEntity(nextWorld, {
    kind: "building",
    cell: blueprint.cell,
    occupiedCells: blueprint.occupiedCells,
    buildingKind: blueprint.blueprintKind,
    label: blueprint.label?.replace("-blueprint", ""),
    interactionCapabilities: blueprint.blueprintKind === "bed" ? ["rest"] : undefined,
    ownership:
      blueprint.blueprintKind === "bed"
        ? {
            ownerPawnId: undefined,
            assignmentReason: "unassigned"
          }
        : undefined
  });
  upsertEntityMutable(nextWorld, building);
  nextWorld.workItems.set(workItem.id, {
    ...workItem,
    status: "completed",
    claimedBy: workItem.claimedBy
  });

  if (building.buildingKind === "bed") {
    nextWorld.restSpots = [
      ...nextWorld.restSpots.filter((spot) => spot.buildingEntityId !== building.id),
      {
        buildingEntityId: building.id,
        cell: building.cell,
        ownerPawnId: undefined,
        assignmentReason: "unassigned"
      }
    ];
  }

  return {
    world: nextWorld,
    outcome: { kind: "completed", createdEntityId: building.id }
  };
}

function findGroundResourceBlockingCell(
  world: WorldCore,
  cell: GridCoord,
  excludeEntityId: string
): WorldEntitySnapshot | undefined {
  const key = coordKey(cell);
  for (const entity of world.entities.values()) {
    if (entity.id === excludeEntityId) continue;
    if (entity.kind !== "resource" || entity.containerKind !== "ground") continue;
    const cells = entity.occupiedCells.length > 0 ? entity.occupiedCells : [entity.cell];
    if (cells.some((c) => coordKey(c) === key)) {
      return entity;
    }
  }
  return undefined;
}

export function completeChopWork(
  world: WorldCore,
  workItem: WorkItemSnapshot
): Readonly<{ world: WorldCore; outcome: CompleteOutcome }> {
  const treeId = workItem.targetEntityId;
  const tree = treeId ? world.entities.get(treeId) : undefined;
  if (!tree || tree.kind !== "tree") {
    return {
      world,
      outcome: { kind: "target-missing" }
    };
  }

  const blockingResource = findGroundResourceBlockingCell(world, tree.cell, tree.id);
  if (blockingResource) {
    return {
      world,
      outcome: {
        kind: "conflict",
        blockingEntityId: blockingResource.id,
        blockingCell: tree.cell
      }
    };
  }

  const nextWorld = cloneWorld(world);
  removeEntityMutable(nextWorld, tree.id);

  const wood = createEntity(nextWorld, {
    kind: "resource",
    cell: { ...tree.cell },
    materialKind: "wood",
    containerKind: "ground",
    pickupAllowed: true
  });
  upsertEntityMutable(nextWorld, wood);

  const pickWorkId = makeWorkItemId(nextWorld);
  nextWorld.nextWorkItemId += 1;
  nextWorld.workItems.set(pickWorkId, {
    id: pickWorkId,
    kind: "pick-up-resource",
    anchorCell: { ...tree.cell },
    targetEntityId: wood.id,
    status: "open",
    failureCount: 0,
    derivedFromWorkId: workItem.id
  });
  attachWorkItemToEntityMutable(nextWorld, wood.id, pickWorkId);

  nextWorld.workItems.set(workItem.id, {
    ...workItem,
    status: "completed",
    claimedBy: workItem.claimedBy
  });

  return {
    world: nextWorld,
    outcome: { kind: "completed", createdEntityId: wood.id }
  };
}

function findFirstStorageZone(world: WorldCore): WorldEntitySnapshot | undefined {
  for (const entity of world.entities.values()) {
    if (entity.kind === "zone" && entity.zoneKind === "storage") {
      return entity;
    }
  }
  return undefined;
}

function zoneFirstDropCell(zone: WorldEntitySnapshot): GridCoord {
  const first = zone.coveredCells?.[0];
  if (first) {
    return { col: first.col, row: first.row };
  }
  return { col: zone.cell.col, row: zone.cell.row };
}

export function completePickUpWork(
  world: WorldCore,
  workItem: WorkItemSnapshot
): Readonly<{ world: WorldCore; outcome: CompleteOutcome }> {
  const resourceId = workItem.targetEntityId;
  const resource = resourceId ? world.entities.get(resourceId) : undefined;
  if (!resource || resource.kind !== "resource") {
    return {
      world,
      outcome: { kind: "target-missing" }
    };
  }

  const carrierId = workItem.claimedBy;
  if (!carrierId) {
    return {
      world,
      outcome: { kind: "not-claim-owner", claimedBy: undefined }
    };
  }

  const nextWorld = cloneWorld(world);
  const prior = nextWorld.entities.get(resource.id)!;
  deleteEntityOccupancy(nextWorld.occupancy, prior.id, prior.occupiedCells);

  const pawn = nextWorld.entities.get(carrierId);
  const nextCell =
    pawn?.kind === "pawn" ? { col: pawn.cell.col, row: pawn.cell.row } : { col: prior.cell.col, row: prior.cell.row };

  upsertEntityMutable(nextWorld, {
    ...prior,
    cell: nextCell,
    occupiedCells: [],
    containerKind: "pawn",
    carriedByPawnId: carrierId,
    containerEntityId: carrierId,
    reservedByPawnId: undefined
  });

  const storageZone = findFirstStorageZone(nextWorld);
  if (storageZone) {
    const dropCell = zoneFirstDropCell(storageZone);
    const haulWorkId = makeWorkItemId(nextWorld);
    nextWorld.nextWorkItemId += 1;
    nextWorld.workItems.set(haulWorkId, {
      id: haulWorkId,
      kind: "haul-to-zone",
      anchorCell: { col: dropCell.col, row: dropCell.row },
      targetEntityId: resource.id,
      status: "open",
      failureCount: 0,
      haulTargetZoneId: storageZone.id,
      haulDropCell: { col: dropCell.col, row: dropCell.row },
      derivedFromWorkId: workItem.id
    });
    attachWorkItemToEntityMutable(nextWorld, resource.id, haulWorkId);
  }

  nextWorld.workItems.set(workItem.id, {
    ...workItem,
    status: "completed",
    claimedBy: workItem.claimedBy
  });

  return {
    world: nextWorld,
    outcome: { kind: "completed" }
  };
}

export function completeHaulWork(
  world: WorldCore,
  workItem: WorkItemSnapshot
): Readonly<{ world: WorldCore; outcome: CompleteOutcome }> {
  const resourceId = workItem.targetEntityId;
  const resource = resourceId ? world.entities.get(resourceId) : undefined;
  if (!resource || resource.kind !== "resource") {
    return {
      world,
      outcome: { kind: "target-missing" }
    };
  }

  const haulZoneId = workItem.haulTargetZoneId;
  const haulDropCell = workItem.haulDropCell;
  if (!haulZoneId || !haulDropCell) {
    return {
      world,
      outcome: { kind: "target-missing" }
    };
  }

  const zone = world.entities.get(haulZoneId);
  if (!zone || zone.kind !== "zone") {
    return {
      world,
      outcome: { kind: "target-missing" }
    };
  }

  const nextWorld = cloneWorld(world);
  const prior = nextWorld.entities.get(resource.id)!;
  deleteEntityOccupancy(nextWorld.occupancy, prior.id, prior.occupiedCells);

  upsertEntityMutable(nextWorld, {
    ...prior,
    cell: { col: haulDropCell.col, row: haulDropCell.row },
    occupiedCells: [],
    containerKind: "zone",
    containerEntityId: haulZoneId,
    carriedByPawnId: undefined,
    reservedByPawnId: undefined
  });

  nextWorld.workItems.set(workItem.id, {
    ...workItem,
    status: "completed",
    claimedBy: workItem.claimedBy
  });

  return {
    world: nextWorld,
    outcome: { kind: "completed" }
  };
}

export function completeWorkItem(
  world: WorldCore,
  workItemId: string,
  pawnId: string
): Readonly<{ world: WorldCore; outcome: CompleteOutcome }> {
  const workItem = world.workItems.get(workItemId);
  if (!workItem) {
    return {
      world,
      outcome: { kind: "missing-work-item" }
    };
  }

  if (workItem.claimedBy !== pawnId) {
    return {
      world,
      outcome: { kind: "not-claim-owner", claimedBy: workItem.claimedBy }
    };
  }

  switch (workItem.kind) {
    case "deconstruct-obstacle":
      return completeDeconstructWork(world, workItem);
    case "construct-blueprint":
      return completeBlueprintWork(world, workItem);
    case "chop-tree":
      return completeChopWork(world, workItem);
    case "pick-up-resource":
      return completePickUpWork(world, workItem);
    case "haul-to-zone":
      return completeHaulWork(world, workItem);
  }
}
