/**
 * 实体生命周期规则：确定性校验 + 在 {@link EntityRegistry} 上执行状态变更（成功路径写入，失败不变）。
 */

import { coordKey, type GridCoord } from "../map/world-grid";
import type {
  BlueprintEntity,
  EntityId,
  EntityKind,
  GameEntity,
  PawnEntity,
  ResourceEntity,
  TreeEntity,
  InteractionCapability
} from "./entity-types";
import type { EntityRegistry } from "./entity-registry";

function cellKeyMatches(a: GridCoord, b: GridCoord): boolean {
  return coordKey(a) === coordKey(b);
}

function blueprintFootprint(blueprint: BlueprintEntity): GridCoord[] {
  const seen = new Set<string>();
  const cells: GridCoord[] = [];
  const add = (c: GridCoord): void => {
    const k = coordKey(c);
    if (seen.has(k)) return;
    seen.add(k);
    cells.push({ col: c.col, row: c.row });
  };
  add(blueprint.cell);
  for (const c of blueprint.coveredCells) add(c);
  return cells;
}

function buildingInteractionCaps(kind: BlueprintEntity["blueprintKind"]): readonly InteractionCapability[] {
  return kind === "bed" ? (["rest"] as const) : [];
}

function blocksBlueprintResolution(
  entity: GameEntity,
  blueprintId: EntityId
): entity is GameEntity {
  if (entity.id === blueprintId) return false;
  switch (entity.kind) {
    case "pawn":
    case "tree":
    case "building":
      return true;
    case "blueprint":
      return true;
    case "resource":
      return entity.containerKind === "ground";
    default:
      return false;
  }
}

export type TransformTreeToResourceOutcome =
  | { kind: "ok"; resourceId: EntityId }
  | { kind: "entity-not-found"; entityId: EntityId }
  | { kind: "wrong-entity-kind"; entityId: EntityId; expected: "tree"; actual: EntityKind }
  | { kind: "cell-blocked"; cell: GridCoord; blockingEntityId: EntityId };

export function transformTreeToResource(registry: EntityRegistry, treeId: EntityId): TransformTreeToResourceOutcome {
  const entity = registry.get(treeId);
  if (!entity) {
    return { kind: "entity-not-found", entityId: treeId };
  }
  if (entity.kind !== "tree") {
    return { kind: "wrong-entity-kind", entityId: treeId, expected: "tree", actual: entity.kind };
  }
  const tree: TreeEntity = entity;
  const cell = tree.cell;
  for (const o of registry.getByCell(cell)) {
    if (o.id === treeId) continue;
    if (o.kind === "resource" && o.containerKind === "ground") {
      return { kind: "cell-blocked", cell: { col: cell.col, row: cell.row }, blockingEntityId: o.id };
    }
  }

  registry.remove(treeId);
  const created = registry.create({
    kind: "resource",
    materialKind: "wood",
    cell: { col: cell.col, row: cell.row },
    containerKind: "ground",
    pickupAllowed: true
  });
  return { kind: "ok", resourceId: created.id };
}

export type TransformBlueprintToBuildingOutcome =
  | { kind: "ok"; buildingId: EntityId }
  | { kind: "entity-not-found"; entityId: EntityId }
  | {
      kind: "wrong-entity-kind";
      entityId: EntityId;
      expected: "blueprint";
      actual: EntityKind;
    }
  | { kind: "footprint-conflict"; cell: GridCoord; blockingEntityId: EntityId };

export function transformBlueprintToBuilding(
  registry: EntityRegistry,
  blueprintId: EntityId
): TransformBlueprintToBuildingOutcome {
  const entity = registry.get(blueprintId);
  if (!entity) {
    return { kind: "entity-not-found", entityId: blueprintId };
  }
  if (entity.kind !== "blueprint") {
    return {
      kind: "wrong-entity-kind",
      entityId: blueprintId,
      expected: "blueprint",
      actual: entity.kind
    };
  }
  const blueprint: BlueprintEntity = entity;

  for (const cell of blueprintFootprint(blueprint)) {
    for (const o of registry.getByCell(cell)) {
      if (blocksBlueprintResolution(o, blueprintId)) {
        return {
          kind: "footprint-conflict",
          cell: { col: cell.col, row: cell.row },
          blockingEntityId: o.id
        };
      }
    }
  }

  registry.remove(blueprintId);
  const caps = buildingInteractionCaps(blueprint.blueprintKind);
  const created = registry.create({
    kind: "building",
    buildingKind: blueprint.blueprintKind,
    cell: { col: blueprint.cell.col, row: blueprint.cell.row },
    coveredCells: blueprint.coveredCells.map((c) => ({ col: c.col, row: c.row })),
    interactionCapabilities: caps.length > 0 ? [...caps] : [],
    ownership:
      blueprint.blueprintKind === "bed"
        ? { ownerPawnId: undefined, assignmentReason: "unassigned" as const }
        : undefined
  });
  return { kind: "ok", buildingId: created.id };
}

export type PickUpResourceOutcome =
  | { kind: "ok" }
  | { kind: "entity-not-found"; entityId: EntityId }
  | { kind: "wrong-entity-kind"; entityId: EntityId; expected: "pawn" | "resource"; actual: EntityKind }
  | { kind: "pickup-not-allowed" }
  | { kind: "resource-not-on-ground" }
  | { kind: "resource-reserved"; reservedByPawnId: EntityId }
  | { kind: "pawn-already-carrying"; carriedResourceId: EntityId };

export function pickUpResource(
  registry: EntityRegistry,
  pawnId: EntityId,
  resourceId: EntityId
): PickUpResourceOutcome {
  const pawnEntity = registry.get(pawnId);
  if (!pawnEntity) {
    return { kind: "entity-not-found", entityId: pawnId };
  }
  if (pawnEntity.kind !== "pawn") {
    return { kind: "wrong-entity-kind", entityId: pawnId, expected: "pawn", actual: pawnEntity.kind };
  }
  const pawn = pawnEntity as PawnEntity;

  const resourceEntity = registry.get(resourceId);
  if (!resourceEntity) {
    return { kind: "entity-not-found", entityId: resourceId };
  }
  if (resourceEntity.kind !== "resource") {
    return {
      kind: "wrong-entity-kind",
      entityId: resourceId,
      expected: "resource",
      actual: resourceEntity.kind
    };
  }
  const resource = resourceEntity as ResourceEntity;

  if (pawn.carriedResourceId !== undefined) {
    return { kind: "pawn-already-carrying", carriedResourceId: pawn.carriedResourceId };
  }
  if (!resource.pickupAllowed) {
    return { kind: "pickup-not-allowed" };
  }
  if (resource.containerKind !== "ground") {
    return { kind: "resource-not-on-ground" };
  }
  if (resource.reservedByPawnId !== undefined && resource.reservedByPawnId !== pawnId) {
    return { kind: "resource-reserved", reservedByPawnId: resource.reservedByPawnId };
  }

  const nextPawn: PawnEntity = {
    ...pawn,
    cell: { col: pawn.cell.col, row: pawn.cell.row },
    carriedResourceId: resourceId
  };
  const nextResource: ResourceEntity = {
    ...resource,
    cell: { col: pawn.cell.col, row: pawn.cell.row },
    containerKind: "pawn",
    containerEntityId: pawnId,
    reservedByPawnId: undefined
  };
  registry.replace(nextPawn);
  registry.replace(nextResource);
  return { kind: "ok" };
}

export type DropResourceOutcome =
  | { kind: "ok" }
  | { kind: "entity-not-found"; entityId: EntityId }
  | { kind: "wrong-entity-kind"; entityId: EntityId; expected: "pawn" | "resource"; actual: EntityKind }
  | { kind: "pawn-not-carrying" }
  | { kind: "carried-resource-mismatch"; carriedResourceId: EntityId; resourceId: EntityId }
  | { kind: "cell-occupied-by-resource"; blockingResourceId: EntityId };

export function dropResource(
  registry: EntityRegistry,
  pawnId: EntityId,
  targetCell: GridCoord
): DropResourceOutcome {
  const pawnEntity = registry.get(pawnId);
  if (!pawnEntity) {
    return { kind: "entity-not-found", entityId: pawnId };
  }
  if (pawnEntity.kind !== "pawn") {
    return { kind: "wrong-entity-kind", entityId: pawnId, expected: "pawn", actual: pawnEntity.kind };
  }
  const pawn = pawnEntity as PawnEntity;

  if (pawn.carriedResourceId === undefined) {
    return { kind: "pawn-not-carrying" };
  }
  const carriedId = pawn.carriedResourceId;

  const resourceEntity = registry.get(carriedId);
  if (!resourceEntity) {
    return { kind: "entity-not-found", entityId: carriedId };
  }
  if (resourceEntity.kind !== "resource") {
    return {
      kind: "wrong-entity-kind",
      entityId: carriedId,
      expected: "resource",
      actual: resourceEntity.kind
    };
  }
  const resource = resourceEntity as ResourceEntity;

  if (resource.containerKind !== "pawn" || resource.containerEntityId !== pawnId) {
    return { kind: "carried-resource-mismatch", carriedResourceId: carriedId, resourceId: resource.id };
  }

  for (const o of registry.getByCell(targetCell)) {
    if (o.kind !== "resource") continue;
    const r = o as ResourceEntity;
    if (r.containerKind !== "ground") continue;
    if (cellKeyMatches(r.cell, targetCell) && r.id !== resource.id) {
      return { kind: "cell-occupied-by-resource", blockingResourceId: r.id };
    }
  }

  const nextPawn: PawnEntity = {
    ...pawn,
    cell: { col: pawn.cell.col, row: pawn.cell.row },
    carriedResourceId: undefined
  };
  const nextResource: ResourceEntity = {
    ...resource,
    cell: { col: targetCell.col, row: targetCell.row },
    containerKind: "ground",
    containerEntityId: undefined
  };
  registry.replace(nextPawn);
  registry.replace(nextResource);
  return { kind: "ok" };
}
