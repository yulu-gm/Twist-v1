/**
 * **工作结算双栈与迁移（审计行动点 #0175）**
 *
 * - **WorldCore 路径**：本文件对 `WorkItemSnapshot` 做 `cloneWorld` 式纯函数结算（`claimWorkItem` / `failWorkItem` / `completeWorkItem` 等）。
 *   主仿真经 `world-work-tick` 锚格读条落成后调用 `completeWorkItem`；场景侧可经 `claimWorkItem` 等与之衔接。
 * - **WorkOrder 路径**：`work-settler` 的 `settleWorkSuccess` / `settleWorkFailure` 在 `WorkRegistry` 上结算，由 `chop-flow`、`build-flow` 等行为 flow 在回报成功时调用。
 *
 * **收敛方向**：单一结算入口——或抽取两路径共用的实体变更内核（与 `entity/lifecycle-rules` 对齐），再保留薄适配层；或选定其一为主模型并将另一路径委托过去。
 * 迁移时需一并调整 `world-work-tick`、相关 flow、`scenario-loader` / headless 认领与测试，避免一侧已结算另一侧仍见旧工单。
 */

import { tryAssignUnownedBedForBuilding } from "../bed-auto-assign";
import { deleteEntityOccupancy, findBlockingOccupant } from "../map/occupancy-manager";
import {
  attachWorkItemToEntityMutable,
  cloneWorld,
  createEntity,
  findExistingWorkItem,
  makeWorkItemId,
  removeEntityMutable,
  upsertEntityMutable
} from "../world-internal";
import { findAvailableStorageCell } from "../map/storage-zones";
import { coordKey, type GridCoord } from "../map/world-grid";
import type { WorldEntitySnapshot } from "../entity/entity-types";
import type { PawnState } from "../pawn-state";
import type { WorldCore } from "../world-core-types";
import type { WorkItemSnapshot } from "./work-types";
import {
  workItemSnapshotForHaulToZone,
  workItemSnapshotForPickUpResource
} from "./work-generator";

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
  /** 搬运工单因前置条件不满足而重置为 open、递增 failureCount；非成功落库。 */
  | Readonly<{ kind: "haul-reopened" }>
  | Readonly<{ kind: "missing-work-item" }>
  | Readonly<{ kind: "not-claim-owner"; claimedBy?: string }>
  | Readonly<{ kind: "target-missing" }>
  | Readonly<{ kind: "blueprint-progress-incomplete"; progress01: number }>
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

/**
 * 需求/昼夜节律导致的工单释放：工单回到 open 供重认领，但不视为执行失败（不计 failureCount）。
 * 与 oh-gen-doc「需求优先级高于普通工作 / 放弃当前工作」一致；`stale-target` 等仍递增计数。
 */
function shouldIncrementFailureCountOnFail(reason: string): boolean {
  if (reason === "night-rest-interrupt") return false;
  if (reason.startsWith("need-interrupt-")) return false;
  return true;
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

  const bumpFailure = shouldIncrementFailureCountOnFail(reason);
  const nextWorld = cloneWorld(world);
  nextWorld.workItems.set(workItemId, {
    ...workItem,
    status: "open",
    claimedBy: undefined,
    failureCount: bumpFailure ? workItem.failureCount + 1 : workItem.failureCount
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
  workItem: WorkItemSnapshot,
  pawns?: readonly PawnState[]
): Readonly<{ world: WorldCore; outcome: CompleteOutcome }> {
  const blueprint = workItem.targetEntityId ? world.entities.get(workItem.targetEntityId) : undefined;
  if (!blueprint) {
    return {
      world,
      outcome: { kind: "target-missing" }
    };
  }

  if (blueprint.kind !== "blueprint") {
    return {
      world,
      outcome: { kind: "target-missing" }
    };
  }

  const progress01 = blueprint.buildProgress01 ?? 0;
  if (progress01 < 1) {
    return {
      world,
      outcome: { kind: "blueprint-progress-incomplete", progress01 }
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
    label: blueprint.blueprintKind,
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
    const afterAssign = tryAssignUnownedBedForBuilding(
      nextWorld,
      building.id,
      pawns,
      workItem.claimedBy
    );
    return {
      world: afterAssign,
      outcome: { kind: "completed", createdEntityId: building.id }
    };
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
    ...workItemSnapshotForPickUpResource(pickWorkId, wood.id, tree.cell),
    derivedFromWorkId: workItem.id
  });
  if (!attachWorkItemToEntityMutable(nextWorld, wood.id, pickWorkId)) {
    throw new Error(
      `completeChopTreeWork: 新木材实体 ${wood.id} 缺失，无法关联拾取工单 ${pickWorkId}`
    );
  }

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

export function completeMineStoneWork(
  world: WorldCore,
  workItem: WorkItemSnapshot
): Readonly<{ world: WorldCore; outcome: CompleteOutcome }> {
  const obstacleId = workItem.targetEntityId;
  const obstacle = obstacleId ? world.entities.get(obstacleId) : undefined;
  if (!obstacle || obstacle.kind !== "obstacle" || obstacle.label !== "stone") {
    return {
      world,
      outcome: { kind: "target-missing" }
    };
  }

  const anchor = obstacle.cell;
  const blockingResource = findGroundResourceBlockingCell(world, anchor, obstacle.id);
  if (blockingResource) {
    return {
      world,
      outcome: {
        kind: "conflict",
        blockingEntityId: blockingResource.id,
        blockingCell: anchor
      }
    };
  }

  const nextWorld = cloneWorld(world);
  removeEntityMutable(nextWorld, obstacle.id);

  const stoneResource = createEntity(nextWorld, {
    kind: "resource",
    cell: { ...anchor },
    materialKind: "stone",
    containerKind: "ground",
    pickupAllowed: true
  });
  upsertEntityMutable(nextWorld, stoneResource);

  const pickWorkId = makeWorkItemId(nextWorld);
  nextWorld.nextWorkItemId += 1;
  nextWorld.workItems.set(pickWorkId, {
    ...workItemSnapshotForPickUpResource(pickWorkId, stoneResource.id, anchor),
    derivedFromWorkId: workItem.id
  });
  if (!attachWorkItemToEntityMutable(nextWorld, stoneResource.id, pickWorkId)) {
    throw new Error(
      `completeMineStoneWork: 新石料实体 ${stoneResource.id} 缺失，无法关联拾取工单 ${pickWorkId}`
    );
  }

  nextWorld.workItems.set(workItem.id, {
    ...workItem,
    status: "completed",
    claimedBy: workItem.claimedBy
  });

  return {
    world: nextWorld,
    outcome: { kind: "completed", createdEntityId: stoneResource.id }
  };
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

  const availableCell = findAvailableStorageCell(nextWorld, resource.id);
  if (availableCell) {
    const drop = { col: availableCell.cell.col, row: availableCell.cell.row };
    const existingHaul = findExistingWorkItem(nextWorld, {
      kind: "haul-to-zone",
      targetEntityId: resource.id,
      anchorCell: drop,
      haulTargetZoneId: availableCell.zoneId,
      haulDropCell: drop,
      derivedFromWorkId: workItem.id
    });
    const haulWorkId = existingHaul?.id ?? makeWorkItemId(nextWorld);
    if (!existingHaul) {
      nextWorld.nextWorkItemId += 1;
      nextWorld.workItems.set(
        haulWorkId,
        workItemSnapshotForHaulToZone(
          haulWorkId,
          resource.id,
          nextCell,
          availableCell.zoneId,
          drop,
          drop,
          workItem.id
        )
      );
    }
    if (!attachWorkItemToEntityMutable(nextWorld, resource.id, haulWorkId)) {
      throw new Error(
        `completePickUpWork: 物资实体 ${resource.id} 缺失，无法关联搬运工单 ${haulWorkId}`
      );
    }
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

function stackCountOf(resource: WorldEntitySnapshot): number {
  return Math.max(1, resource.stackCount ?? 1);
}

function isStackable(resource: WorldEntitySnapshot): boolean {
  return resource.stackable ?? true;
}

function zoneCoversCell(zone: WorldEntitySnapshot, cell: GridCoord): boolean {
  return (zone.coveredCells ?? []).some((coveredCell) => coordKey(coveredCell) === coordKey(cell));
}

function zoneAllowsResource(zone: WorldEntitySnapshot, resource: WorldEntitySnapshot): boolean {
  const filterMode = zone.storageFilterMode ?? "allow-all";
  const acceptedKinds = zone.acceptedMaterialKinds ?? [];
  if (filterMode === "allow-all") {
    return true;
  }
  return acceptedKinds.includes(resource.materialKind ?? "generic");
}

function zoneResourcesAtCell(world: WorldCore, cell: GridCoord, excludeEntityId?: string): WorldEntitySnapshot[] {
  const key = coordKey(cell);
  return [...world.entities.values()]
    .filter((entity) => {
      if (entity.id === excludeEntityId) return false;
      if (entity.kind !== "resource") return false;
      if (entity.containerKind !== "zone") return false;
      return coordKey(entity.cell) === key;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

type PlannedHaulSlotState =
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "stack"; stackTarget: WorldEntitySnapshot }>
  | Readonly<{ kind: "blocked" }>;

function getPlannedHaulSlotState(
  world: WorldCore,
  resource: WorldEntitySnapshot,
  zoneId: string,
  dropCell: GridCoord
): PlannedHaulSlotState {
  const zoneResources = zoneResourcesAtCell(world, dropCell, resource.id);
  if (zoneResources.length === 0) {
    return { kind: "empty" };
  }

  const [stackTarget] = zoneResources;
  if (!stackTarget) {
    return { kind: "empty" };
  }

  const incompatibleSibling = zoneResources.some(
    (entity) =>
      entity.containerEntityId !== zoneId ||
      entity.materialKind !== resource.materialKind ||
      !isStackable(entity)
  );
  if (incompatibleSibling) {
    return { kind: "blocked" };
  }

  return {
    kind: "stack",
    stackTarget
  };
}

function reopenHaulWorkAtDropCell(
  nextWorld: WorldCore,
  workItem: WorkItemSnapshot,
  prior: WorldEntitySnapshot,
  dropCell: GridCoord
): Readonly<{ world: WorldCore; outcome: CompleteOutcome }> {
  const blocking = findBlockingOccupant(nextWorld.occupancy, [dropCell], prior.id);
  const occupiedCells = blocking ? [] : [{ col: dropCell.col, row: dropCell.row }];

  upsertEntityMutable(nextWorld, {
    ...prior,
    cell: { col: dropCell.col, row: dropCell.row },
    occupiedCells,
    containerKind: "ground",
    containerEntityId: undefined,
    carriedByPawnId: undefined,
    reservedByPawnId: undefined
  });

  nextWorld.workItems.set(workItem.id, {
    ...workItem,
    status: "open",
    claimedBy: undefined,
    failureCount: workItem.failureCount + 1
  });

  return {
    world: nextWorld,
    outcome: { kind: "haul-reopened" }
  };
}

function reopenHaulWork(
  nextWorld: WorldCore,
  workItem: WorkItemSnapshot,
  prior: WorldEntitySnapshot
): Readonly<{ world: WorldCore; outcome: CompleteOutcome }> {
  const claimedBy = workItem.claimedBy;
  const claimedPawn = claimedBy ? nextWorld.entities.get(claimedBy) : undefined;
  const claimantIsCarrying =
    prior.containerKind === "pawn" &&
    prior.carriedByPawnId === claimedBy &&
    (prior.containerEntityId === undefined || prior.containerEntityId === claimedBy);

  const dropCell =
    claimantIsCarrying && claimedPawn?.kind === "pawn"
      ? { col: claimedPawn.cell.col, row: claimedPawn.cell.row }
      : { col: prior.cell.col, row: prior.cell.row };

  return reopenHaulWorkAtDropCell(nextWorld, workItem, prior, dropCell);
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

  const carryingPawnId = workItem.claimedBy;
  const claimantIsCarrying =
    prior.containerKind === "pawn" &&
    prior.carriedByPawnId === carryingPawnId &&
    (prior.containerEntityId === undefined || prior.containerEntityId === carryingPawnId);
  if (!claimantIsCarrying) {
    return reopenHaulWork(nextWorld, workItem, prior);
  }

  const zoneResolved = nextWorld.entities.get(haulZoneId);
  if (!zoneResolved || zoneResolved.kind !== "zone") {
    return reopenHaulWork(nextWorld, workItem, prior);
  }

  if (!zoneCoversCell(zoneResolved, haulDropCell) || !zoneAllowsResource(zoneResolved, prior)) {
    return reopenHaulWork(nextWorld, workItem, prior);
  }

  const plannedSlotState = getPlannedHaulSlotState(nextWorld, prior, haulZoneId, haulDropCell);
  if (plannedSlotState.kind === "blocked") {
    return reopenHaulWork(nextWorld, workItem, prior);
  }

  if (
    plannedSlotState.kind === "stack" &&
    plannedSlotState.stackTarget.materialKind === prior.materialKind &&
    isStackable(plannedSlotState.stackTarget) &&
    isStackable(prior)
  ) {
    nextWorld.entities.set(plannedSlotState.stackTarget.id, {
      ...plannedSlotState.stackTarget,
      stackCount: stackCountOf(plannedSlotState.stackTarget) + stackCountOf(prior)
    });
    nextWorld.entities.delete(prior.id);
  } else {
    upsertEntityMutable(nextWorld, {
      ...prior,
      cell: { col: haulDropCell.col, row: haulDropCell.row },
      occupiedCells: [],
      containerKind: "zone",
      containerEntityId: haulZoneId,
      carriedByPawnId: undefined,
      reservedByPawnId: undefined
    });
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

export type CompleteWorkItemContext = Readonly<{
  /** 施工结算时传入，用于木床落成按全量小人列表在「施工者优先」之后挑选无床者。 */
  pawns?: readonly PawnState[];
}>;

export function completeWorkItem(
  world: WorldCore,
  workItemId: string,
  pawnId: string,
  context?: CompleteWorkItemContext
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
      return completeBlueprintWork(world, workItem, context?.pawns);
    case "chop-tree":
      return completeChopWork(world, workItem);
    case "mine-stone":
      return completeMineStoneWork(world, workItem);
    case "pick-up-resource":
      return completePickUpWork(world, workItem);
    case "haul-to-zone":
      return completeHaulWork(world, workItem);
  }
}
