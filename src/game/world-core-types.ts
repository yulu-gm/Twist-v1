import type {
  BuildingKind,
  BuildState,
  EntityOwnership,
  InteractionCapability,
  ResourceContainerKind,
  ResourceMaterialKind,
  RestSpotSnapshot,
  WorldEntityKind,
  WorldEntitySnapshot,
  ZoneKind
} from "./entity/entity-types";
import type { OccupancyMap } from "./map/occupancy-manager";
import type { GridCoord, WorldGridConfig } from "./map/world-grid";
import type { TimeOfDayConfig } from "./time/time-of-day";
import type { WorldTimeSnapshot } from "./time/world-time";
import type { WorkItemSnapshot } from "./work/work-types";

export type MarkerSnapshot = Readonly<{
  id: string;
  kind: "deconstruct-obstacle";
  cell: GridCoord;
  targetEntityId: string;
  workItemId: string;
}>;

/**
 * 领域只读快照：`time` 已含 `currentPeriod` 等投影结果；附带 `timeConfig` 便于验收/调试复算昼夜边界。
 * 刻意不包含 `grid`（`WorldGridConfig`）——地图尺度与阻挡等仍以 {@link WorldCore} 为准，避免与 `occupancy`/实体 footprint 重复或漂移。
 */
export type WorldSnapshot = Readonly<{
  time: WorldTimeSnapshot;
  /** 与 {@link WorldCore.timeConfig} 对齐的日内规则；与 `time` 一并构成时间语义完整只读视图。 */
  timeConfig: TimeOfDayConfig;
  entities: readonly WorldEntitySnapshot[];
  /** 格键 → 该格上的实体 id 列表（与 oh-gen-doc「地图格.包含实体」对齐；空格不出现在 Record 中）。 */
  occupancy: Readonly<Record<string, readonly string[]>>;
  markers: readonly MarkerSnapshot[];
  workItems: readonly WorkItemSnapshot[];
  restSpots: readonly RestSpotSnapshot[];
}>;

export type WorldCore = {
  grid: WorldGridConfig;
  time: WorldTimeSnapshot;
  timeConfig: TimeOfDayConfig;
  entities: Map<string, WorldEntitySnapshot>;
  occupancy: OccupancyMap;
  markers: Map<string, MarkerSnapshot>;
  workItems: Map<string, WorkItemSnapshot>;
  restSpots: readonly RestSpotSnapshot[];
  nextEntityId: number;
  nextMarkerId: number;
  nextWorkItemId: number;
};

export type EntityDraft = Readonly<{
  kind: WorldEntityKind;
  cell: GridCoord;
  occupiedCells?: readonly GridCoord[];
  label?: string;
  buildingKind?: BuildingKind;
  blueprintKind?: BuildingKind;
  buildProgress01?: number;
  buildState?: BuildState;
  relatedWorkItemIds?: readonly string[];
  interactionCapabilities?: readonly InteractionCapability[];
  ownership?: EntityOwnership;
  materialKind?: ResourceMaterialKind;
  containerKind?: ResourceContainerKind;
  containerEntityId?: string;
  pickupAllowed?: boolean;
  reservedByPawnId?: string;
  loggingMarked?: boolean;
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
