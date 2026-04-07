import type { BuildState, WorldEntitySnapshot } from "./entity/entity-types";
import {
  deleteEntityOccupancy,
  findBlockingOccupant,
  writeEntityOccupancy
} from "./map/occupancy-manager";
import { isInsideGrid, type GridCoord, type WorldGridConfig } from "./map/world-grid";
import type { WorkItemKind, WorkItemSnapshot } from "./work/work-types";
import type { EntityDraft, WorldCore } from "./world-core-types";

/** 工作去重查询条件：未提供的可选维度不参与比较（与既有「仅 kind + target」行为兼容）。 */
export type FindExistingWorkItemCriteria = Readonly<{
  kind: WorkItemKind;
  targetEntityId: string;
  /** 若提供，仅与相同 {@link WorkItemSnapshot.anchorCell} 的工单合并。 */
  anchorCell?: GridCoord;
  /** 若提供，仅与相同 {@link WorkItemSnapshot.haulTargetZoneId} 的 `haul-to-zone` 工单合并。 */
  haulTargetZoneId?: string;
  /** 若提供，仅与相同 {@link WorkItemSnapshot.haulDropCell} 的工单合并。 */
  haulDropCell?: GridCoord;
  /** 若提供，仅与相同 {@link WorkItemSnapshot.derivedFromWorkId} 的工单合并（链路去重）。 */
  derivedFromWorkId?: string;
}>;

function sameGridCell(a: GridCoord, b: GridCoord): boolean {
  return a.row === b.row && a.col === b.col;
}

function workItemMatchesFindCriteria(
  work: WorkItemSnapshot,
  criteria: FindExistingWorkItemCriteria
): boolean {
  if (work.kind !== criteria.kind) return false;
  if (work.status === "completed") return false;
  if (work.targetEntityId !== criteria.targetEntityId) return false;
  if (criteria.anchorCell !== undefined && !sameGridCell(work.anchorCell, criteria.anchorCell)) {
    return false;
  }
  if (
    criteria.haulTargetZoneId !== undefined &&
    work.haulTargetZoneId !== criteria.haulTargetZoneId
  ) {
    return false;
  }
  if (criteria.haulDropCell !== undefined) {
    if (!work.haulDropCell || !sameGridCell(work.haulDropCell, criteria.haulDropCell)) {
      return false;
    }
  }
  if (
    criteria.derivedFromWorkId !== undefined &&
    work.derivedFromWorkId !== criteria.derivedFromWorkId
  ) {
    return false;
  }
  return true;
}

export type SpawnOutcome =
  | Readonly<{ kind: "created" }>
  | Readonly<{ kind: "conflict"; blockingEntityId: string; blockingCell: GridCoord }>
  | Readonly<{ kind: "out-of-bounds"; cell: GridCoord }>
  | Readonly<{ kind: "invalid-draft"; reason: string }>;

const VALID_BUILD_STATES: ReadonlySet<BuildState> = new Set([
  "planned",
  "in-progress",
  "completed"
]);

/**
 * 按 `oh-gen-doc/实体系统` 与 `oh-code-design/实体系统` 各原型关键字段，校验写入 {@link WorldCore} 前的 {@link EntityDraft}。
 * {@link spawnWorldEntity} 与 {@link createEntity} 的集中落点。
 */
export function validateEntityDraft(
  draft: EntityDraft
): Readonly<{ ok: true } | { ok: false; reason: string }> {
  switch (draft.kind) {
    case "pawn":
    case "obstacle":
      return { ok: true };
    case "tree":
      if (typeof draft.loggingMarked !== "boolean") {
        return {
          ok: false,
          reason:
            "tree：需要 boolean 类型的 loggingMarked（对应策划文档中树木伐木/标记状态的可序列化字段）"
        };
      }
      return { ok: true };
    case "resource":
      if (draft.materialKind === undefined) {
        return { ok: false, reason: "resource：缺少 materialKind（物资类型）" };
      }
      if (draft.containerKind === undefined) {
        return { ok: false, reason: "resource：缺少 containerKind（所在容器类别）" };
      }
      if (typeof draft.pickupAllowed !== "boolean") {
        return {
          ok: false,
          reason: "resource：需要 boolean 类型的 pickupAllowed（可拾取标记）"
        };
      }
      return { ok: true };
    case "blueprint":
      if (draft.blueprintKind === undefined) {
        return { ok: false, reason: "blueprint：缺少 blueprintKind" };
      }
      const p = draft.buildProgress01;
      if (
        p === undefined ||
        typeof p !== "number" ||
        !Number.isFinite(p) ||
        p < 0 ||
        p > 1
      ) {
        return {
          ok: false,
          reason: "blueprint：需要 0..1 范围内的有限数值 buildProgress01（建造进度）"
        };
      }
      if (draft.buildState === undefined || !VALID_BUILD_STATES.has(draft.buildState)) {
        return { ok: false, reason: "blueprint：缺少有效的 buildState（planned | in-progress | completed）" };
      }
      return { ok: true };
    case "building":
      if (draft.buildingKind === undefined) {
        return { ok: false, reason: "building：缺少 buildingKind" };
      }
      return { ok: true };
    case "zone":
      if (draft.zoneKind === undefined) {
        return { ok: false, reason: "zone：缺少 zoneKind" };
      }
      if (draft.coveredCells === undefined || draft.coveredCells.length === 0) {
        return {
          ok: false,
          reason: "zone：需要非空 coveredCells（区域覆盖范围，见策划「区域实体」关键字段）"
        };
      }
      return { ok: true };
    default: {
      const _never: never = draft.kind;
      return { ok: false, reason: `未知实体 kind: ${String(_never)}` };
    }
  }
}

export function cloneWorld(world: WorldCore): WorldCore {
  return {
    ...world,
    entities: new Map(world.entities),
    occupancy: new Map([...world.occupancy.entries()].map(([k, v]) => [k, new Set(v)])),
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

export function removeEntityMutable(world: WorldCore, entityId: string): WorldEntitySnapshot | undefined {
  const entity = world.entities.get(entityId);
  if (!entity) return undefined;
  deleteEntityOccupancy(world.occupancy, entityId, entity.occupiedCells);
  world.entities.delete(entityId);
  return entity;
}

export function upsertEntityMutable(world: WorldCore, entity: WorldEntitySnapshot): void {
  world.entities.set(entity.id, entity);
  const occ = writeEntityOccupancy(world.occupancy, entity.id, entity.occupiedCells);
  if (process.env.NODE_ENV !== "production" && !occ.ok) {
    throw new Error(
      `upsertEntityMutable: occupancy write blocked for ${entity.id}: ${JSON.stringify(occ.conflicts)}`
    );
  }
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
  const draftOk = validateEntityDraft(draft);
  if (!draftOk.ok) {
    throw new Error(`createEntity: invalid draft (kind=${draft.kind}): ${draftOk.reason}`);
  }
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
    carriedByPawnId: draft.carriedByPawnId,
    stackCount: draft.stackCount,
    stackable: draft.stackable,
    storageFilterMode: draft.storageFilterMode,
    storageGroupDisplayName: draft.storageGroupDisplayName,
    allowedMaterialKinds: draft.allowedMaterialKinds
      ? [...draft.allowedMaterialKinds]
      : undefined
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
  const draftCheck = validateEntityDraft(draft);
  if (!draftCheck.ok) {
    return {
      world,
      entityId: "",
      outcome: { kind: "invalid-draft", reason: draftCheck.reason }
    };
  }

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
  criteria: FindExistingWorkItemCriteria
): WorkItemSnapshot | undefined {
  for (const workItem of world.workItems.values()) {
    if (workItemMatchesFindCriteria(workItem, criteria)) {
      return workItem;
    }
  }
  return undefined;
}

/**
 * 将工单 ID 写入实体的 `relatedWorkItemIds`。
 * @returns 实体存在并已更新（或已包含该工单 ID）为 `true`；目标实体不存在为 `false`（编排层可据此断言或记录）。
 */
export function attachWorkItemToEntityMutable(
  world: WorldCore,
  entityId: string,
  workItemId: string
): boolean {
  const entity = world.entities.get(entityId);
  if (!entity) return false;
  world.entities.set(entityId, withRelatedWorkItem(entity, workItemId));
  return true;
}
