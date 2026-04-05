import { coordKey, type GridCoord } from "../map/world-grid";
import type {
  BlueprintEntity,
  BuildingEntity,
  EntityId,
  EntityKind,
  GameEntity,
  PawnEntity,
  ReadonlyEntitySnapshot,
  ResourceEntity,
  TreeEntity,
  ZoneEntity
} from "./entity-types";

/** 创建实体时由注册表写入 {@link EntityId}，草案不含 id。 */
export type GameEntityDraft =
  | Omit<PawnEntity, "id">
  | Omit<ResourceEntity, "id">
  | Omit<TreeEntity, "id">
  | Omit<BlueprintEntity, "id">
  | Omit<BuildingEntity, "id">
  | Omit<ZoneEntity, "id">;

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
