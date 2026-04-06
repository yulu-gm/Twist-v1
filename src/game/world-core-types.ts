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

export type WorldSnapshot = Readonly<{
  time: WorldTimeSnapshot;
  entities: readonly WorldEntitySnapshot[];
  occupancy: Readonly<Record<string, string>>;
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
