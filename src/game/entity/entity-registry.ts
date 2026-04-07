import { coordKey, type GridCoord } from "../map/world-grid";
import type {
  BlueprintEntity,
  BuildingEntity,
  BuildState,
  EntityId,
  EntityKind,
  GameEntity,
  InteractionCapability,
  PawnEntity,
  ReadonlyEntitySnapshot,
  ResourceContainerKind,
  ResourceEntity,
  ResourceMaterialKind,
  TreeEntity,
  ZoneEntity,
  ZoneKind
} from "./entity-types";

const MATERIAL_KINDS = new Set<ResourceMaterialKind>(["wood", "food", "stone", "generic"]);
const CONTAINER_KINDS = new Set<ResourceContainerKind>(["ground", "pawn", "zone", "building"]);
const ZONE_KINDS = new Set<ZoneKind>(["storage", "forbidden", "priority-build", "custom"]);
const BUILD_STATES = new Set<BuildState>(["planned", "in-progress", "completed"]);
const INTERACTION_CAPS = new Set<InteractionCapability>(["rest"]);

function createDraftError(message: string): Error {
  return new Error(`EntityRegistry.create: ${message}`);
}

function isGridCoord(value: unknown): value is GridCoord {
  if (value === null || typeof value !== "object") return false;
  const v = value as { col?: unknown; row?: unknown };
  return (
    typeof v.col === "number" &&
    typeof v.row === "number" &&
    Number.isFinite(v.col) &&
    Number.isFinite(v.row)
  );
}

function assertCoordArray(cells: unknown, label: string): asserts cells is readonly GridCoord[] {
  if (!Array.isArray(cells)) {
    throw createDraftError(`${label} must be an array`);
  }
  for (let i = 0; i < cells.length; i += 1) {
    if (!isGridCoord(cells[i])) {
      throw createDraftError(`${label}[${i}] is not a valid grid coordinate`);
    }
  }
}

/** 创建实体时由注册表写入 {@link EntityId}，草案不含 id。 */
export type GameEntityDraft =
  | Omit<PawnEntity, "id">
  | Omit<ResourceEntity, "id">
  | Omit<TreeEntity, "id">
  | Omit<BlueprintEntity, "id">
  | Omit<BuildingEntity, "id">
  | Omit<ZoneEntity, "id">;

/** 与「领域规则层」对齐的草案守门：拒绝明显非法形状，避免进入注册表 Map。 */
function assertValidGameEntityDraft(draft: GameEntityDraft): void {
  if (draft === null || typeof draft !== "object") {
    throw createDraftError("draft must be a non-null object");
  }

  switch (draft.kind) {
    case "pawn": {
      if (!isGridCoord(draft.cell)) throw createDraftError("pawn.cell is invalid");
      if (typeof draft.satiety !== "number" || !Number.isFinite(draft.satiety)) {
        throw createDraftError("pawn.satiety must be a finite number");
      }
      if (typeof draft.energy !== "number" || !Number.isFinite(draft.energy)) {
        throw createDraftError("pawn.energy must be a finite number");
      }
      return;
    }
    case "resource": {
      if (!MATERIAL_KINDS.has(draft.materialKind)) {
        throw createDraftError("resource.materialKind is invalid");
      }
      if (!isGridCoord(draft.cell)) throw createDraftError("resource.cell is invalid");
      if (!CONTAINER_KINDS.has(draft.containerKind)) {
        throw createDraftError("resource.containerKind is invalid");
      }
      if (typeof draft.pickupAllowed !== "boolean") {
        throw createDraftError("resource.pickupAllowed must be a boolean");
      }
      if (draft.containerKind === "ground") {
        if (draft.containerEntityId !== undefined) {
          throw createDraftError("resource with containerKind ground must not set containerEntityId");
        }
      } else if (draft.containerEntityId === undefined || draft.containerEntityId === "") {
        throw createDraftError(
          "resource with non-ground containerKind requires a non-empty containerEntityId"
        );
      }
      if (draft.stackCount !== undefined) {
        if (typeof draft.stackCount !== "number" || !Number.isFinite(draft.stackCount) || draft.stackCount < 1) {
          throw createDraftError("resource.stackCount must be a finite number >= 1 when set");
        }
      }
      if (draft.stackable !== undefined && typeof draft.stackable !== "boolean") {
        throw createDraftError("resource.stackable must be a boolean when set");
      }
      return;
    }
    case "tree": {
      if (!isGridCoord(draft.cell)) throw createDraftError("tree.cell is invalid");
      if (typeof draft.loggingMarked !== "boolean") {
        throw createDraftError("tree.loggingMarked must be a boolean");
      }
      if (typeof draft.occupied !== "boolean") {
        throw createDraftError("tree.occupied must be a boolean");
      }
      return;
    }
    case "blueprint": {
      if (draft.blueprintKind !== "wall" && draft.blueprintKind !== "bed") {
        throw createDraftError("blueprint.blueprintKind is invalid");
      }
      if (!isGridCoord(draft.cell)) throw createDraftError("blueprint.cell is invalid");
      assertCoordArray(draft.coveredCells, "blueprint.coveredCells");
      if (typeof draft.buildProgress01 !== "number" || !Number.isFinite(draft.buildProgress01)) {
        throw createDraftError("blueprint.buildProgress01 must be a finite number");
      }
      if (!BUILD_STATES.has(draft.buildState)) {
        throw createDraftError("blueprint.buildState is invalid");
      }
      if (!Array.isArray(draft.relatedWorkItemIds)) {
        throw createDraftError("blueprint.relatedWorkItemIds must be an array");
      }
      for (let i = 0; i < draft.relatedWorkItemIds.length; i += 1) {
        const id = draft.relatedWorkItemIds[i];
        if (typeof id !== "string") {
          throw createDraftError(`blueprint.relatedWorkItemIds[${i}] must be a string`);
        }
      }
      return;
    }
    case "building": {
      if (draft.buildingKind !== "wall" && draft.buildingKind !== "bed") {
        throw createDraftError("building.buildingKind is invalid");
      }
      if (!isGridCoord(draft.cell)) throw createDraftError("building.cell is invalid");
      assertCoordArray(draft.coveredCells, "building.coveredCells");
      if (!Array.isArray(draft.interactionCapabilities)) {
        throw createDraftError("building.interactionCapabilities must be an array");
      }
      for (let i = 0; i < draft.interactionCapabilities.length; i += 1) {
        const cap = draft.interactionCapabilities[i];
        if (!INTERACTION_CAPS.has(cap as InteractionCapability)) {
          throw createDraftError(`building.interactionCapabilities[${i}] is not a known capability`);
        }
      }
      if (draft.ownership !== undefined) {
        const o = draft.ownership;
        if (o.ownerPawnId !== undefined && typeof o.ownerPawnId !== "string") {
          throw createDraftError("building.ownership.ownerPawnId must be a string when set");
        }
        if (o.assignmentReason !== "unassigned") {
          throw createDraftError("building.ownership.assignmentReason is invalid");
        }
      }
      return;
    }
    case "zone": {
      if (!ZONE_KINDS.has(draft.zoneKind)) {
        throw createDraftError("zone.zoneKind is invalid");
      }
      assertCoordArray(draft.coveredCells, "zone.coveredCells");
      if (typeof draft.name !== "string") {
        throw createDraftError("zone.name must be a string");
      }
      if (!Array.isArray(draft.acceptedMaterialKinds)) {
        throw createDraftError("zone.acceptedMaterialKinds must be an array");
      }
      for (let i = 0; i < draft.acceptedMaterialKinds.length; i += 1) {
        const mk = draft.acceptedMaterialKinds[i];
        if (!MATERIAL_KINDS.has(mk)) {
          throw createDraftError(`zone.acceptedMaterialKinds[${i}] is invalid`);
        }
      }
      if (draft.storageFilterMode !== undefined) {
        if (draft.storageFilterMode !== "allow-all" && draft.storageFilterMode !== "allow-list") {
          throw createDraftError("zone.storageFilterMode is invalid");
        }
      }
      if (draft.storageGroupDisplayName !== undefined && typeof draft.storageGroupDisplayName !== "string") {
        throw createDraftError("zone.storageGroupDisplayName must be a string when set");
      }
      if (draft.allowedMaterialKinds !== undefined) {
        if (!Array.isArray(draft.allowedMaterialKinds)) {
          throw createDraftError("zone.allowedMaterialKinds must be an array when set");
        }
        for (let i = 0; i < draft.allowedMaterialKinds.length; i += 1) {
          const mk = draft.allowedMaterialKinds[i];
          if (!MATERIAL_KINDS.has(mk)) {
            throw createDraftError(`zone.allowedMaterialKinds[${i}] is invalid`);
          }
        }
      }
      return;
    }
    default: {
      const k = (draft as { kind?: string }).kind;
      throw createDraftError(`unknown entity kind: ${String(k)}`);
    }
  }
}

function cellKeyMatches(a: GridCoord, b: GridCoord): boolean {
  return coordKey(a) === coordKey(b);
}

function entityTouchesCell(entity: GameEntity, cell: GridCoord): boolean {
  switch (entity.kind) {
    case "zone":
      return entity.coveredCells.some((c) => cellKeyMatches(c, cell));
    case "blueprint":
    case "building":
      if (cellKeyMatches(entity.cell, cell)) return true;
      return entity.coveredCells.some((c) => cellKeyMatches(c, cell));
    default:
      return cellKeyMatches(entity.cell, cell);
  }
}

function toReadonlySnapshot(entity: GameEntity): ReadonlyEntitySnapshot {
  switch (entity.kind) {
    case "pawn":
      return {
        ...entity,
        cell: { ...entity.cell },
        behavior: entity.behavior,
        currentGoal: entity.currentGoal
      };
    case "resource":
      return {
        ...entity,
        cell: { ...entity.cell }
      };
    case "tree":
      return {
        ...entity,
        cell: { ...entity.cell }
      };
    case "blueprint":
      return {
        ...entity,
        cell: { ...entity.cell },
        coveredCells: entity.coveredCells.map((c) => ({ ...c })),
        relatedWorkItemIds: [...entity.relatedWorkItemIds]
      };
    case "building":
      return {
        ...entity,
        cell: { ...entity.cell },
        coveredCells: entity.coveredCells.map((c) => ({ ...c })),
        interactionCapabilities: entity.interactionCapabilities ? [...entity.interactionCapabilities] : entity.interactionCapabilities,
        ownership: entity.ownership ? { ...entity.ownership } : entity.ownership
      };
    case "zone":
      return {
        ...entity,
        coveredCells: entity.coveredCells.map((c) => ({ ...c })),
        acceptedMaterialKinds: [...entity.acceptedMaterialKinds]
      };
  }
}

export class EntityRegistry {
  private readonly entities = new Map<EntityId, GameEntity>();
  private nextNumericId = 1;

  private allocateId(): EntityId {
    const id = `entity-${this.nextNumericId}` as EntityId;
    this.nextNumericId += 1;
    return id;
  }

  create(draft: GameEntityDraft): GameEntity {
    assertValidGameEntityDraft(draft);
    const id = this.allocateId();
    const entity = { ...draft, id } as GameEntity;
    this.entities.set(id, entity);
    return entity;
  }

  remove(id: EntityId): void {
    this.entities.delete(id);
  }

  /**
   * 用同 {@link EntityId} 的完整实体替换已登记项（拾取/放下等需保持 id 不变的更新）。
   * 若 id 不存在则抛错；调用方应在规则层先校验。
   */
  replace(entity: GameEntity): void {
    if (!this.entities.has(entity.id)) {
      throw new Error(`EntityRegistry.replace: unknown entity id ${entity.id}`);
    }
    this.entities.set(entity.id, entity);
  }

  get(id: EntityId): GameEntity | undefined {
    return this.entities.get(id);
  }

  getByKind(kind: EntityKind): GameEntity[] {
    const out: GameEntity[] = [];
    for (const e of this.entities.values()) {
      if (e.kind === kind) out.push(e);
    }
    return out;
  }

  getByCell(cell: GridCoord): GameEntity[] {
    const out: GameEntity[] = [];
    for (const e of this.entities.values()) {
      if (entityTouchesCell(e, cell)) out.push(e);
    }
    return out;
  }

  getAll(): GameEntity[] {
    return [...this.entities.values()];
  }

  snapshot(): ReadonlyEntitySnapshot[] {
    return this.getAll().map((e) => toReadonlySnapshot(e));
  }
}

export function createEntityRegistry(): EntityRegistry {
  return new EntityRegistry();
}
