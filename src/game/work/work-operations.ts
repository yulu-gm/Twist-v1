import {
  cloneWorld,
  createEntity,
  findBlockingOccupant,
  removeEntityMutable,
  upsertEntityMutable
} from "../world-internal";
import type { GridCoord } from "../map/world-grid";
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
  }
}
