/**
 * 实体关系一致性：床铺归属、物资容器位置、携带双向引用。
 *
 * 校验函数约定：
 * - {@link validateBedOwnership}、{@link validateResourceLocation}、{@link validateCarrying}
 *   均返回 `{ ok, violations }`。
 * - **`ok === true` 当且仅当 `violations.length === 0`**，便于调用方用布尔或明细任一方式判断。
 */

import type {
  AssignmentReason,
  EntityId,
  BuildingEntity,
  EntityKind,
  EntityOwnership,
  GameEntity,
  PawnEntity,
  ResourceEntity
} from "./entity-types";
import type { EntityRegistry } from "./entity-registry";

/** “床铺”语义：与 world-core 床建筑一致——`buildingKind === "bed"` 或具备 `rest` 交互能力。 */
export function isBedLikeBuilding(entity: GameEntity): entity is BuildingEntity {
  if (entity.kind !== "building") return false;
  if (entity.buildingKind === "bed") return true;
  return entity.interactionCapabilities.includes("rest");
}

export type BedOwnershipViolation =
  | { kind: "bed-owner-target-missing"; bedId: EntityId; ownerPawnId: EntityId }
  | { kind: "bed-owner-target-not-pawn"; bedId: EntityId; ownerPawnId: EntityId; actualKind: EntityKind }
  | { kind: "bed-owner-pawn-bed-mismatch"; bedId: EntityId; pawnId: EntityId; pawnBedBuildingId?: EntityId }
  | { kind: "pawn-bed-building-missing"; pawnId: EntityId; bedBuildingId: EntityId }
  | { kind: "pawn-bed-building-not-bedlike"; pawnId: EntityId; bedBuildingId: EntityId }
  | { kind: "pawn-bed-ownership-mismatch"; pawnId: EntityId; bedBuildingId: EntityId; ownerOnBed?: EntityId }
  | { kind: "multiple-pawns-same-bed"; bedId: EntityId; pawnIds: readonly EntityId[] }
  | { kind: "multiple-beds-same-owner"; pawnId: EntityId; bedIds: readonly EntityId[] };

export type BedOwnershipValidationResult = Readonly<{
  /** 无违规时为 `true`，等价于 `violations.length === 0`。 */
  ok: boolean;
  violations: readonly BedOwnershipViolation[];
}>;

/**
 * 校验：每张床铺至多归属一个小人；小人与建筑的 `ownership.ownerPawnId`、`pawn.bedBuildingId` 双向一致。
 * 与 {@link isBedLikeBuilding} 认定的实体参与校验；非床铺建筑不检查归属字段。
 */
export function validateBedOwnership(registry: EntityRegistry): BedOwnershipValidationResult {
  const violations: BedOwnershipViolation[] = [];

  const bedLikes: BuildingEntity[] = [];
  for (const e of registry.getAll()) {
    if (isBedLikeBuilding(e)) bedLikes.push(e);
  }

  const ownerToBeds = new Map<EntityId, EntityId[]>();
  for (const bed of bedLikes) {
    const owner = bed.ownership?.ownerPawnId;
    if (owner === undefined) continue;
    const ownerId = owner as EntityId;
    const list = ownerToBeds.get(ownerId) ?? [];
    list.push(bed.id);
    ownerToBeds.set(ownerId, list);

    const pawnEnt = registry.get(ownerId);
    if (!pawnEnt) {
      violations.push({ kind: "bed-owner-target-missing", bedId: bed.id, ownerPawnId: ownerId });
      continue;
    }
    if (pawnEnt.kind !== "pawn") {
      violations.push({
        kind: "bed-owner-target-not-pawn",
        bedId: bed.id,
        ownerPawnId: ownerId,
        actualKind: pawnEnt.kind
      });
      continue;
    }
    const pawn = pawnEnt as PawnEntity;
    if (pawn.bedBuildingId !== bed.id) {
      violations.push({
        kind: "bed-owner-pawn-bed-mismatch",
        bedId: bed.id,
        pawnId: pawn.id,
        pawnBedBuildingId: pawn.bedBuildingId
      });
    }
  }

  for (const [pawnId, bedIds] of ownerToBeds) {
    if (bedIds.length > 1) {
      violations.push({ kind: "multiple-beds-same-owner", pawnId, bedIds });
    }
  }

  const bedToPawns = new Map<EntityId, EntityId[]>();
  for (const e of registry.getAll()) {
    if (e.kind !== "pawn") continue;
    const pawn = e as PawnEntity;
    const bid = pawn.bedBuildingId;
    if (bid === undefined) continue;
    const list = bedToPawns.get(bid) ?? [];
    list.push(pawn.id);
    bedToPawns.set(bid, list);

    const bedEnt = registry.get(bid);
    if (!bedEnt) {
      violations.push({ kind: "pawn-bed-building-missing", pawnId: pawn.id, bedBuildingId: bid });
      continue;
    }
    if (!isBedLikeBuilding(bedEnt)) {
      violations.push({ kind: "pawn-bed-building-not-bedlike", pawnId: pawn.id, bedBuildingId: bid });
      continue;
    }
    const bed = bedEnt;
    const ownerOnBed = bed.ownership?.ownerPawnId;
    if (ownerOnBed !== pawn.id) {
      violations.push({
        kind: "pawn-bed-ownership-mismatch",
        pawnId: pawn.id,
        bedBuildingId: bid,
        ownerOnBed: ownerOnBed as EntityId | undefined
      });
    }
  }

  for (const [bedId, pawnIds] of bedToPawns) {
    if (pawnIds.length > 1) {
      violations.push({ kind: "multiple-pawns-same-bed", bedId, pawnIds });
    }
  }

  return { ok: violations.length === 0, violations };
}

export type ResourceLocationViolation =
  | {
      kind: "resource-ground-has-container-entity";
      resourceId: EntityId;
      containerEntityId: EntityId;
    }
  | {
      kind: "resource-container-missing-entity-id";
      resourceId: EntityId;
      containerKind: ResourceEntity["containerKind"];
    }
  | { kind: "resource-container-entity-not-found"; resourceId: EntityId; containerEntityId: EntityId }
  | {
      kind: "resource-container-entity-wrong-kind";
      resourceId: EntityId;
      containerEntityId: EntityId;
      containerKind: ResourceEntity["containerKind"];
      actualKind: EntityKind;
    };

export type ResourceLocationValidationResult = Readonly<{
  ok: boolean;
  violations: readonly ResourceLocationViolation[];
}>;

/**
 * 校验：每条物资的 `containerKind` / `containerEntityId` 组合自洽，且容器实体存在且类型匹配。
 * `ground` 表示位于地图格，`containerEntityId` 必须为 `undefined`（唯一位置：格 + 无容器实体）。
 */
export function validateResourceLocation(registry: EntityRegistry): ResourceLocationValidationResult {
  const violations: ResourceLocationViolation[] = [];

  for (const e of registry.getAll()) {
    if (e.kind !== "resource") continue;
    const r = e as ResourceEntity;

    if (r.containerKind === "ground") {
      if (r.containerEntityId !== undefined) {
        violations.push({
          kind: "resource-ground-has-container-entity",
          resourceId: r.id,
          containerEntityId: r.containerEntityId
        });
      }
      continue;
    }

    if (r.containerEntityId === undefined) {
      violations.push({
        kind: "resource-container-missing-entity-id",
        resourceId: r.id,
        containerKind: r.containerKind
      });
      continue;
    }

    const ctnId = r.containerEntityId;
    const ctn = registry.get(ctnId);
    if (!ctn) {
      violations.push({ kind: "resource-container-entity-not-found", resourceId: r.id, containerEntityId: ctnId });
      continue;
    }

    const expectedKind: EntityKind | undefined =
      r.containerKind === "pawn"
        ? "pawn"
        : r.containerKind === "zone"
          ? "zone"
          : r.containerKind === "building"
            ? "building"
            : undefined;

    if (expectedKind !== undefined && ctn.kind !== expectedKind) {
      violations.push({
        kind: "resource-container-entity-wrong-kind",
        resourceId: r.id,
        containerEntityId: ctnId,
        containerKind: r.containerKind,
        actualKind: ctn.kind
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

export type CarryingViolation =
  | { kind: "pawn-carried-resource-missing"; pawnId: EntityId; carriedResourceId: EntityId }
  | { kind: "pawn-carried-not-resource"; pawnId: EntityId; carriedResourceId: EntityId; actualKind: EntityKind }
  | {
      kind: "pawn-carried-resource-container-mismatch";
      pawnId: EntityId;
      carriedResourceId: EntityId;
      resourceContainerKind: ResourceEntity["containerKind"];
      resourceContainerEntityId?: EntityId;
    }
  | { kind: "resource-pawn-container-missing-carrier"; resourceId: EntityId; containerEntityId: EntityId }
  | {
      kind: "resource-pawn-container-wrong-carrier";
      resourceId: EntityId;
      containerEntityId: EntityId;
      carriers: readonly EntityId[];
    }
  | { kind: "pawn-multiple-carried-resources"; pawnId: EntityId; carriedResourceIds: readonly EntityId[] };

export type CarryingValidationResult = Readonly<{
  ok: boolean;
  violations: readonly CarryingViolation[];
}>;

/**
 * 校验：小人最多携带一个物资（由单字段保证）；若携带则资源必须为 `containerKind === "pawn"`
 * 且 `containerEntityId === pawn.id`。反之，凡在 pawn 容器内的资源，其携带者必须在 `carriedResourceId` 中引用该资源。
 */
export function validateCarrying(registry: EntityRegistry): CarryingValidationResult {
  const violations: CarryingViolation[] = [];

  for (const e of registry.getAll()) {
    if (e.kind !== "pawn") continue;
    const pawn = e as PawnEntity;
    if (pawn.carriedResourceId === undefined) continue;

    const res = registry.get(pawn.carriedResourceId);
    if (!res) {
      violations.push({
        kind: "pawn-carried-resource-missing",
        pawnId: pawn.id,
        carriedResourceId: pawn.carriedResourceId
      });
      continue;
    }
    if (res.kind !== "resource") {
      violations.push({
        kind: "pawn-carried-not-resource",
        pawnId: pawn.id,
        carriedResourceId: pawn.carriedResourceId,
        actualKind: res.kind
      });
      continue;
    }
    const resource = res as ResourceEntity;
    if (resource.containerKind !== "pawn" || resource.containerEntityId !== pawn.id) {
      violations.push({
        kind: "pawn-carried-resource-container-mismatch",
        pawnId: pawn.id,
        carriedResourceId: resource.id,
        resourceContainerKind: resource.containerKind,
        resourceContainerEntityId: resource.containerEntityId
      });
    }
  }

  const pawnToCarriedFromResources = new Map<EntityId, EntityId[]>();
  for (const e of registry.getAll()) {
    if (e.kind !== "resource") continue;
    const r = e as ResourceEntity;
    if (r.containerKind !== "pawn" || r.containerEntityId === undefined) continue;
    const pid = r.containerEntityId;
    const list = pawnToCarriedFromResources.get(pid) ?? [];
    list.push(r.id);
    pawnToCarriedFromResources.set(pid, list);
  }

  for (const [pawnId, resourceIds] of pawnToCarriedFromResources) {
    if (resourceIds.length > 1) {
      violations.push({
        kind: "pawn-multiple-carried-resources",
        pawnId,
        carriedResourceIds: resourceIds
      });
      continue;
    }
    const pawnEnt = registry.get(pawnId);
    if (!pawnEnt || pawnEnt.kind !== "pawn") {
      violations.push({
        kind: "resource-pawn-container-missing-carrier",
        resourceId: resourceIds[0]!,
        containerEntityId: pawnId
      });
      continue;
    }
    const pawn = pawnEnt as PawnEntity;
    const expected = resourceIds[0];
    if (resourceIds.length === 1 && pawn.carriedResourceId !== expected) {
      violations.push({
        kind: "resource-pawn-container-wrong-carrier",
        resourceId: expected!,
        containerEntityId: pawnId,
        carriers: pawn.carriedResourceId !== undefined ? [pawn.carriedResourceId] : []
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

export type AssignBedOutcome =
  | { kind: "ok" }
  | { kind: "entity-not-found"; entityId: EntityId }
  | { kind: "bed-not-bedlike"; bedId: EntityId }
  | { kind: "wrong-entity-kind"; entityId: EntityId; expected: "pawn"; actual: EntityKind };

function ownershipAssigned(pawnId: EntityId, reason: Exclude<AssignmentReason, "unassigned">): EntityOwnership {
  return { ownerPawnId: pawnId, assignmentReason: reason };
}

function ownershipUnassigned(): EntityOwnership {
  return { ownerPawnId: undefined, assignmentReason: "unassigned" };
}

/**
 * 将床铺分配给小人：更新建筑 `ownership` 与 `pawn.bedBuildingId`，并解除此前与该床/该人冲突的分配。
 * @param assignmentReason 写入建筑 `ownership.assignmentReason`，默认 `manual`（显式分配）；建成链路请用 `auto-after-construction`。
 */
export function assignBedToPawn(
  registry: EntityRegistry,
  bedId: EntityId,
  pawnId: EntityId,
  assignmentReason: Exclude<AssignmentReason, "unassigned"> = "manual"
): AssignBedOutcome {
  const bedEntity = registry.get(bedId);
  if (!bedEntity) {
    return { kind: "entity-not-found", entityId: bedId };
  }
  if (!isBedLikeBuilding(bedEntity)) {
    return { kind: "bed-not-bedlike", bedId };
  }
  const bed = bedEntity;

  const pawnEntity = registry.get(pawnId);
  if (!pawnEntity) {
    return { kind: "entity-not-found", entityId: pawnId };
  }
  if (pawnEntity.kind !== "pawn") {
    return { kind: "wrong-entity-kind", entityId: pawnId, expected: "pawn", actual: pawnEntity.kind };
  }
  let pawn = pawnEntity as PawnEntity;

  for (const e of registry.getAll()) {
    if (!isBedLikeBuilding(e)) continue;
    const o = e.ownership?.ownerPawnId;
    if (o !== pawnId) continue;
    if (e.id === bedId) continue;
    const otherBed = e;
    registry.replace({
      ...otherBed,
      cell: { ...otherBed.cell },
      coveredCells: otherBed.coveredCells.map((c) => ({ ...c })),
      interactionCapabilities: [...otherBed.interactionCapabilities],
      ownership: ownershipUnassigned()
    });
  }

  const prevBedId = pawn.bedBuildingId;
  if (prevBedId !== undefined && prevBedId !== bedId) {
    const prevBedEntity = registry.get(prevBedId);
    if (prevBedEntity && isBedLikeBuilding(prevBedEntity)) {
      const prevBed = prevBedEntity;
      registry.replace({
        ...prevBed,
        cell: { ...prevBed.cell },
        coveredCells: prevBed.coveredCells.map((c) => ({ ...c })),
        interactionCapabilities: [...prevBed.interactionCapabilities],
        ownership: ownershipUnassigned()
      });
    }
  }

  const prevOwner = bed.ownership?.ownerPawnId as EntityId | undefined;
  if (prevOwner !== undefined && prevOwner !== pawnId) {
    const prevOwnerEntity = registry.get(prevOwner);
    if (prevOwnerEntity && prevOwnerEntity.kind === "pawn") {
      const prevPawn = prevOwnerEntity as PawnEntity;
      if (prevPawn.bedBuildingId === bedId) {
        registry.replace({
          ...prevPawn,
          cell: { ...prevPawn.cell },
          bedBuildingId: undefined
        });
      }
    }
  }

  registry.replace({
    ...bed,
    cell: { ...bed.cell },
    coveredCells: bed.coveredCells.map((c) => ({ ...c })),
    interactionCapabilities: [...bed.interactionCapabilities],
    ownership: ownershipAssigned(pawnId, assignmentReason)
  });

  pawn = registry.get(pawnId) as PawnEntity;
  registry.replace({
    ...pawn,
    cell: { ...pawn.cell },
    bedBuildingId: bedId
  });

  return { kind: "ok" };
}

export type UnassignBedOutcome =
  | { kind: "ok" }
  | { kind: "entity-not-found"; entityId: EntityId }
  | { kind: "bed-not-bedlike"; bedId: EntityId };

/** 取消床铺分配：清空建筑 `ownership.ownerPawnId` 与对应小人的 `bedBuildingId`。 */
export function unassignBed(registry: EntityRegistry, bedId: EntityId): UnassignBedOutcome {
  const bedEntity = registry.get(bedId);
  if (!bedEntity) {
    return { kind: "entity-not-found", entityId: bedId };
  }
  if (!isBedLikeBuilding(bedEntity)) {
    return { kind: "bed-not-bedlike", bedId };
  }
  const bed = bedEntity;

  const owner = bed.ownership?.ownerPawnId as EntityId | undefined;
  if (owner !== undefined) {
    const pawnEntity = registry.get(owner);
    if (pawnEntity && pawnEntity.kind === "pawn") {
      const pawn = pawnEntity as PawnEntity;
      if (pawn.bedBuildingId === bedId) {
        registry.replace({
          ...pawn,
          cell: { ...pawn.cell },
          bedBuildingId: undefined
        });
      }
    }
  }

  registry.replace({
    ...bed,
    cell: { ...bed.cell },
    coveredCells: bed.coveredCells.map((c) => ({ ...c })),
    interactionCapabilities: [...bed.interactionCapabilities],
    ownership: ownershipUnassigned()
  });

  return { kind: "ok" };
}
