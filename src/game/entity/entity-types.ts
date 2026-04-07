/**
 * 实体领域类型：与 oh-code-design/实体系统 对齐的六种原型可辨识联合。
 */

import type { GridCoord } from "../map/world-grid";
import type { PawnActionState, PawnGoalState } from "../pawn-state";

/** 与 world-core 序列化视图一致的实体种类（可走“障碍/蓝图/建筑/小人”四条枚举）。 */
export type WorldEntityKind =
  | "pawn"
  | "obstacle"
  | "blueprint"
  | "building"
  | "tree"
  | "resource"
  | "zone";

export type BuildingKind = "wall" | "bed";

export type BuildState = "planned" | "in-progress" | "completed";

export type InteractionCapability = "rest";

/**
 * 树实体在地图反馈上的伐木视觉相位（只读投影）。
 * - `normal`：未标记且无未完成 chop 工单。
 * - `marked`：已标记伐木和/或存在开放 chop 工单（队列预占）。
 * - `chopping`：存在已认领的 chop 工单（小人正在执行伐木）。
 */
export type TreeLoggingVisualPhase = "normal" | "marked" | "chopping";

/** 床铺归属原因：`unassigned` 表示无主人；其余值区分来源，便于手动调整与排错追溯。 */
export type AssignmentReason =
  | "unassigned"
  | "manual"
  | "auto-after-construction"
  | "auto-unowned-fill";

export type EntityOwnership = Readonly<{
  ownerPawnId?: string;
  assignmentReason: AssignmentReason;
}>;

/** world-core 导出的只读实体条；占格语义与 `occupiedCells` 一致。 */
export type WorldEntitySnapshot = Readonly<{
  id: string;
  kind: WorldEntityKind;
  cell: GridCoord;
  occupiedCells: readonly GridCoord[];
  label?: string;
  buildingKind?: BuildingKind;
  blueprintKind?: BuildingKind;
  buildProgress01?: number;
  buildState?: BuildState;
  relatedWorkItemIds: readonly string[];
  interactionCapabilities?: readonly InteractionCapability[];
  ownership?: EntityOwnership;
  materialKind?: ResourceMaterialKind;
  containerKind?: ResourceContainerKind;
  containerEntityId?: string;
  pickupAllowed?: boolean;
  reservedByPawnId?: string;
  loggingMarked?: boolean;
  /** 仅 `kind==="tree"`：存在未认领的 `chop-tree` 工单指向本树（工作队列预占）。 */
  treeChopWorkOpen?: boolean;
  /** 仅 `kind==="tree"`：存在已认领且未完成的 `chop-tree` 工单（伐木中）。 */
  treeChopWorkClaimed?: boolean;
  /** 仅 `kind==="tree"`：由 `getWorldSnapshot` / `projectTreeSnapshotsForRender` 等填充。 */
  treeLoggingVisualPhase?: TreeLoggingVisualPhase;
  /** 地图石料障碍是否已登记开采工单（与 trees 的 loggingMarked 对称）。 */
  miningMarked?: boolean;
  zoneKind?: ZoneKind;
  coveredCells?: readonly GridCoord[];
  acceptedMaterialKinds?: readonly ResourceMaterialKind[];
  carriedByPawnId?: string;
  stackCount?: number;
  stackable?: boolean;
  storageFilterMode?: "allow-all" | "allow-list";
  storageGroupDisplayName?: string;
  allowedMaterialKinds?: readonly ResourceMaterialKind[];
}>;

export type RestSpotSnapshot = Readonly<{
  buildingEntityId: string;
  cell: GridCoord;
  ownerPawnId?: string;
  assignmentReason: AssignmentReason;
}>;

declare const entityIdBrand: unique symbol;

/** 全局唯一实体标识（opaque 品牌类型）。 */
export type EntityId = string & { readonly [entityIdBrand]: typeof entityIdBrand };

export type EntityKind = "pawn" | "resource" | "tree" | "blueprint" | "building" | "zone";

/** 物资细分类型（树木转木头等流程会用到具体种类）。 */
export type ResourceMaterialKind = "wood" | "food" | "stone" | "generic";

/** 物资所在容器类别（地面、小人携带、区域、建筑内存储等）。 */
export type ResourceContainerKind = "ground" | "pawn" | "zone" | "building";

/** 与 {@link ResourceContainerKind} 一一对应；扩展 union 时需补全键以通过类型检查。 */
const RESOURCE_CONTAINER_KIND_SET: Record<ResourceContainerKind, true> = {
  ground: true,
  pawn: true,
  zone: true,
  building: true
};

/** 全部 {@link ResourceContainerKind} 字面量（顺序依实现而定），供迭代与表驱动校验。 */
export const RESOURCE_CONTAINER_KINDS = Object.keys(
  RESOURCE_CONTAINER_KIND_SET
) as ResourceContainerKind[];

export function isResourceContainerKind(value: string): value is ResourceContainerKind {
  return Object.prototype.hasOwnProperty.call(RESOURCE_CONTAINER_KIND_SET, value);
}

/** 区域用途分类。 */
export type ZoneKind = "storage" | "forbidden" | "priority-build" | "custom";

export type PawnEntity = Readonly<{
  id: EntityId;
  kind: "pawn";
  /** 逻辑占格中心/主格位置。 */
  cell: GridCoord;
  /** 行为状态（当前行动）。 */
  behavior: PawnActionState | undefined;
  /** 当前目标（规划层意图）。 */
  currentGoal: PawnGoalState | undefined;
  /** 携带的物资实体标识；未携带时为 undefined。 */
  carriedResourceId?: EntityId;
  /** 饱食度（0..100，与需求/进食规则一致的量纲）。 */
  satiety: number;
  /** 精力值（0..100）。 */
  energy: number;
  /** 归属床铺对应建筑实体标识。 */
  bedBuildingId?: EntityId;
}>;

export type ResourceEntity = Readonly<{
  id: EntityId;
  kind: "resource";
  materialKind: ResourceMaterialKind;
  /** 世界格位置（地面散落或在容器内时仍可记录锚定格/最后已知格）。 */
  cell: GridCoord;
  containerKind: ResourceContainerKind;
  /** 容器实体标识（例如存储区、建筑存储槽、携带者小人）。 */
  containerEntityId?: EntityId;
  /** 是否允许被拾取。 */
  pickupAllowed: boolean;
  /** 当前占用/预占该资源的小人实体标识。 */
  reservedByPawnId?: EntityId;
  /** 当前堆叠数量；未显式设置时视为 1。 */
  stackCount?: number;
  /** 是否允许和同类型物品堆叠到同格。 */
  stackable?: boolean;
}>;

export type TreeEntity = Readonly<{
  id: EntityId;
  kind: "tree";
  cell: GridCoord;
  /** 是否已被标记为待伐。 */
  loggingMarked: boolean;
  /** 是否被工作/交互预占。 */
  occupied: boolean;
}>;

export type BlueprintEntity = Readonly<{
  id: EntityId;
  kind: "blueprint";
  blueprintKind: BuildingKind;
  cell: GridCoord;
  coveredCells: readonly GridCoord[];
  buildProgress01: number;
  buildState: BuildState;
  relatedWorkItemIds: readonly string[];
}>;

export type BuildingEntity = Readonly<{
  id: EntityId;
  kind: "building";
  buildingKind: BuildingKind;
  cell: GridCoord;
  coveredCells: readonly GridCoord[];
  interactionCapabilities: readonly InteractionCapability[];
  ownership?: EntityOwnership;
}>;

export type ZoneEntity = Readonly<{
  id: EntityId;
  kind: "zone";
  zoneKind: ZoneKind;
  coveredCells: readonly GridCoord[];
  name: string;
  /** 可接受的物资类型；空数组表示由上层规则解释（例如不做限制或拒绝所有）。 */
  acceptedMaterialKinds: readonly ResourceMaterialKind[];
  storageFilterMode?: "allow-all" | "allow-list";
  storageGroupDisplayName?: string;
  allowedMaterialKinds?: readonly ResourceMaterialKind[];
}>;

export type GameEntity =
  | PawnEntity
  | ResourceEntity
  | TreeEntity
  | BlueprintEntity
  | BuildingEntity
  | ZoneEntity;

/** 只读实体快照：供 UI、查询与序列化消费的稳定投影。 */
export type ReadonlyEntitySnapshot = GameEntity;
