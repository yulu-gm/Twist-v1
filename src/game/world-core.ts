import {
  advanceTimeOfDay,
  effectiveSimulationDeltaSeconds,
  type TimeControlState,
  type TimeOfDayConfig,
  type TimeOfDayState,
  DEFAULT_TIME_CONTROL_STATE,
  DEFAULT_TIME_OF_DAY_CONFIG
} from "./time-of-day";
import { coordKey, isInsideGrid, type GridCoord, type WorldGridConfig } from "./world-grid";

export type WorldEntityKind = "pawn" | "obstacle" | "blueprint" | "building";
export type BuildingKind = "bed";
export type WorkItemKind = "deconstruct-obstacle" | "construct-blueprint";
export type WorkItemStatus = "open" | "claimed" | "completed";
export type BuildState = "planned" | "in-progress" | "completed";
export type TimePeriod = "day" | "night";
export type InteractionCapability = "rest";
export type AssignmentReason = "unassigned";

export type EntityOwnership = Readonly<{
  ownerPawnId?: string;
  assignmentReason: AssignmentReason;
}>;

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
}>;

export type MarkerSnapshot = Readonly<{
  id: string;
  kind: "deconstruct-obstacle";
  cell: GridCoord;
  targetEntityId: string;
  workItemId: string;
}>;

export type WorkItemSnapshot = Readonly<{
  id: string;
  kind: WorkItemKind;
  anchorCell: GridCoord;
  targetEntityId?: string;
  status: WorkItemStatus;
  claimedBy?: string;
  failureCount: number;
}>;

export type RestSpotSnapshot = Readonly<{
  buildingEntityId: string;
  cell: GridCoord;
  ownerPawnId?: string;
  assignmentReason: AssignmentReason;
}>;

export type WorldTimeSnapshot = Readonly<{
  dayNumber: number;
  minuteOfDay: number;
  dayProgress01: number;
  currentPeriod: TimePeriod;
  paused: boolean;
  speed: TimeControlState["speed"];
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
  occupancy: Map<string, string>;
  markers: Map<string, MarkerSnapshot>;
  workItems: Map<string, WorkItemSnapshot>;
  restSpots: readonly RestSpotSnapshot[];
  nextEntityId: number;
  nextMarkerId: number;
  nextWorkItemId: number;
};

type EntityDraft = Readonly<{
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
}>;

type CreateWorldCoreOptions = Readonly<{
  grid: WorldGridConfig;
  timeState?: TimeOfDayState;
  timeConfig?: TimeOfDayConfig;
}>;

type SpawnOutcome =
  | Readonly<{ kind: "created" }>
  | Readonly<{ kind: "conflict"; blockingEntityId: string; blockingCell: GridCoord }>
  | Readonly<{ kind: "out-of-bounds"; cell: GridCoord }>;

type MoveOutcome =
  | Readonly<{ kind: "moved" }>
  | Readonly<{ kind: "missing-entity" }>
  | Readonly<{ kind: "conflict"; blockingEntityId: string; blockingCell: GridCoord }>
  | Readonly<{ kind: "out-of-bounds"; cell: GridCoord }>;

type RemoveOutcome = Readonly<{ kind: "removed" }> | Readonly<{ kind: "missing-entity" }>;

type ClaimOutcome =
  | Readonly<{ kind: "claimed" }>
  | Readonly<{ kind: "missing-work-item" }>
  | Readonly<{ kind: "already-claimed"; claimedBy: string }>;

type FailOutcome =
  | Readonly<{ kind: "failed"; reason: string }>
  | Readonly<{ kind: "missing-work-item" }>
  | Readonly<{ kind: "not-claim-owner"; claimedBy?: string }>;

type CompleteOutcome =
  | Readonly<{ kind: "completed"; createdEntityId?: string }>
  | Readonly<{ kind: "missing-work-item" }>
  | Readonly<{ kind: "not-claim-owner"; claimedBy?: string }>
  | Readonly<{ kind: "target-missing" }>
  | Readonly<{ kind: "conflict"; blockingEntityId: string; blockingCell: GridCoord }>;

export type WorldTimeEvent =
  | Readonly<{
      kind: "time-advanced";
      dayNumber: number;
      minuteOfDay: number;
      currentPeriod: TimePeriod;
    }>
  | Readonly<{
      kind: "period-changed";
      dayNumber: number;
      period: TimePeriod;
    }>
  | Readonly<{
      kind: "day-changed";
      dayNumber: number;
    }>;

function cloneWorld(world: WorldCore): WorldCore {
  return {
    ...world,
    entities: new Map(world.entities),
    occupancy: new Map(world.occupancy),
    markers: new Map(world.markers),
    workItems: new Map(world.workItems),
    restSpots: [...world.restSpots]
  };
}

/** 深拷贝世界状态（回放基线、验收重绕等）。 */
export function cloneWorldCoreState(world: WorldCore): WorldCore {
  return cloneWorld(world);
}

function timePeriodForMinute(minuteOfDay: number): TimePeriod {
  return minuteOfDay >= 6 * 60 && minuteOfDay < 18 * 60 ? "day" : "night";
}

function toWorldTimeSnapshot(
  state: TimeOfDayState,
  controls: TimeControlState
): WorldTimeSnapshot {
  return {
    dayNumber: state.dayNumber,
    minuteOfDay: state.minuteOfDay,
    dayProgress01: state.minuteOfDay / (24 * 60),
    currentPeriod: timePeriodForMinute(state.minuteOfDay),
    paused: controls.paused,
    speed: controls.speed
  };
}

function toTimeOfDayState(snapshot: WorldTimeSnapshot): TimeOfDayState {
  return {
    dayNumber: snapshot.dayNumber,
    minuteOfDay: snapshot.minuteOfDay
  };
}

function makeEntityId(world: WorldCore): string {
  return `entity-${world.nextEntityId}`;
}

function makeMarkerId(world: WorldCore): string {
  return `marker-${world.nextMarkerId}`;
}

function makeWorkItemId(world: WorldCore): string {
  return `work-${world.nextWorkItemId}`;
}

function normalizeOccupiedCells(draft: EntityDraft): readonly GridCoord[] {
  return draft.occupiedCells?.length ? [...draft.occupiedCells] : [draft.cell];
}

function shiftOccupiedCells(
  occupiedCells: readonly GridCoord[],
  fromCell: GridCoord,
  toCell: GridCoord
): readonly GridCoord[] {
  const deltaCol = toCell.col - fromCell.col;
  const deltaRow = toCell.row - fromCell.row;
  return occupiedCells.map((cell) => ({
    col: cell.col + deltaCol,
    row: cell.row + deltaRow
  }));
}

function firstInvalidCell(
  grid: WorldGridConfig,
  occupiedCells: readonly GridCoord[]
): GridCoord | undefined {
  return occupiedCells.find((cell) => !isInsideGrid(grid, cell));
}

function findBlockingOccupant(
  occupancy: ReadonlyMap<string, string>,
  occupiedCells: readonly GridCoord[],
  selfEntityId?: string
): { blockingEntityId: string; blockingCell: GridCoord } | undefined {
  for (const cell of occupiedCells) {
    const occupantId = occupancy.get(coordKey(cell));
    if (!occupantId || occupantId === selfEntityId) continue;
    return {
      blockingEntityId: occupantId,
      blockingCell: cell
    };
  }
  return undefined;
}

function writeEntityOccupancy(
  occupancy: Map<string, string>,
  entityId: string,
  occupiedCells: readonly GridCoord[]
): void {
  for (const cell of occupiedCells) {
    occupancy.set(coordKey(cell), entityId);
  }
}

function deleteEntityOccupancy(
  occupancy: Map<string, string>,
  occupiedCells: readonly GridCoord[]
): void {
  for (const cell of occupiedCells) {
    occupancy.delete(coordKey(cell));
  }
}

function removeEntityMutable(world: WorldCore, entityId: string): WorldEntitySnapshot | undefined {
  const entity = world.entities.get(entityId);
  if (!entity) return undefined;
  deleteEntityOccupancy(world.occupancy, entity.occupiedCells);
  world.entities.delete(entityId);
  return entity;
}

function upsertEntityMutable(world: WorldCore, entity: WorldEntitySnapshot): void {
  world.entities.set(entity.id, entity);
  writeEntityOccupancy(world.occupancy, entity.id, entity.occupiedCells);
}

function withRelatedWorkItem(
  entity: WorldEntitySnapshot,
  workItemId: string
): WorldEntitySnapshot {
  if (entity.relatedWorkItemIds.includes(workItemId)) return entity;
  return {
    ...entity,
    relatedWorkItemIds: [...entity.relatedWorkItemIds, workItemId]
  };
}

function createEntity(world: WorldCore, draft: EntityDraft): WorldEntitySnapshot {
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
    ownership: draft.ownership
  };
  world.nextEntityId += 1;
  return entity;
}

function findExistingWorkItem(
  world: WorldCore,
  kind: WorkItemKind,
  targetEntityId: string
): WorkItemSnapshot | undefined {
  for (const workItem of world.workItems.values()) {
    if (
      workItem.kind === kind &&
      workItem.targetEntityId === targetEntityId &&
      workItem.status !== "completed"
    ) {
      return workItem;
    }
  }
  return undefined;
}

function attachWorkItemToEntityMutable(world: WorldCore, entityId: string, workItemId: string): void {
  const entity = world.entities.get(entityId);
  if (!entity) return;
  world.entities.set(entityId, withRelatedWorkItem(entity, workItemId));
}

function markWorkClaimedState(workItem: WorkItemSnapshot, pawnId: string): WorkItemSnapshot {
  return {
    ...workItem,
    status: "claimed",
    claimedBy: pawnId
  };
}

export function createWorldCore(options: CreateWorldCoreOptions): WorldCore {
  const timeConfig = options.timeConfig ?? DEFAULT_TIME_OF_DAY_CONFIG;
  const timeState = options.timeState ?? {
    dayNumber: 1,
    minuteOfDay: timeConfig.startMinuteOfDay
  };

  return {
    grid: options.grid,
    time: toWorldTimeSnapshot(timeState, DEFAULT_TIME_CONTROL_STATE),
    timeConfig,
    entities: new Map(),
    occupancy: new Map(),
    markers: new Map(),
    workItems: new Map(),
    restSpots: [],
    nextEntityId: 1,
    nextMarkerId: 1,
    nextWorkItemId: 1
  };
}

export function getWorldSnapshot(world: WorldCore): WorldSnapshot {
  const entities = [...world.entities.values()].map((entity) => ({
    ...entity,
    occupiedCells: entity.occupiedCells.map((cell) => ({ ...cell })),
    relatedWorkItemIds: [...entity.relatedWorkItemIds],
    interactionCapabilities: entity.interactionCapabilities
      ? [...entity.interactionCapabilities]
      : undefined,
    ownership: entity.ownership ? { ...entity.ownership } : undefined
  }));
  const markers = [...world.markers.values()].map((marker) => ({
    ...marker,
    cell: { ...marker.cell }
  }));
  const workItems = [...world.workItems.values()].map((workItem) => ({
    ...workItem,
    anchorCell: { ...workItem.anchorCell }
  }));
  const restSpots = world.restSpots.map((spot) => ({
    ...spot,
    cell: { ...spot.cell }
  }));

  return {
    time: { ...world.time },
    entities,
    occupancy: Object.fromEntries(world.occupancy),
    markers,
    workItems,
    restSpots
  };
}

export function spawnWorldEntity(
  world: WorldCore,
  draft: EntityDraft
): Readonly<{ world: WorldCore; entityId: string; outcome: SpawnOutcome }> {
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

export function moveWorldEntity(
  world: WorldCore,
  entityId: string,
  nextCell: GridCoord
): Readonly<{ world: WorldCore; outcome: MoveOutcome }> {
  const entity = world.entities.get(entityId);
  if (!entity) {
    return {
      world,
      outcome: { kind: "missing-entity" }
    };
  }

  const nextOccupiedCells = shiftOccupiedCells(entity.occupiedCells, entity.cell, nextCell);
  const invalidCell = firstInvalidCell(world.grid, nextOccupiedCells);
  if (invalidCell) {
    return {
      world,
      outcome: { kind: "out-of-bounds", cell: invalidCell }
    };
  }

  const blocking = findBlockingOccupant(world.occupancy, nextOccupiedCells, entityId);
  if (blocking) {
    return {
      world,
      outcome: { kind: "conflict", ...blocking }
    };
  }

  const nextWorld = cloneWorld(world);
  removeEntityMutable(nextWorld, entityId);
  upsertEntityMutable(nextWorld, {
    ...entity,
    cell: nextCell,
    occupiedCells: nextOccupiedCells
  });
  return {
    world: nextWorld,
    outcome: { kind: "moved" }
  };
}

export function removeWorldEntity(
  world: WorldCore,
  entityId: string
): Readonly<{ world: WorldCore; outcome: RemoveOutcome }> {
  if (!world.entities.has(entityId)) {
    return {
      world,
      outcome: { kind: "missing-entity" }
    };
  }

  const nextWorld = cloneWorld(world);
  removeEntityMutable(nextWorld, entityId);
  nextWorld.restSpots = nextWorld.restSpots.filter((spot) => spot.buildingEntityId !== entityId);
  return {
    world: nextWorld,
    outcome: { kind: "removed" }
  };
}

export function advanceWorldClock(
  world: WorldCore,
  deltaSeconds: number,
  controls: TimeControlState
): Readonly<{ world: WorldCore; elapsedSimulationSeconds: number; events: readonly WorldTimeEvent[] }> {
  const effectiveDeltaSeconds = effectiveSimulationDeltaSeconds(deltaSeconds, controls);
  if (effectiveDeltaSeconds === 0) {
    return {
      world: {
        ...world,
        time: {
          ...world.time,
          paused: controls.paused,
          speed: controls.speed
        }
      },
      elapsedSimulationSeconds: 0,
      events: []
    };
  }

  const previousTime = world.time;
  const nextState = advanceTimeOfDay(
    toTimeOfDayState(previousTime),
    effectiveDeltaSeconds,
    world.timeConfig
  );
  const nextTime = toWorldTimeSnapshot(nextState, controls);
  const events: WorldTimeEvent[] = [
    {
      kind: "time-advanced",
      dayNumber: nextTime.dayNumber,
      minuteOfDay: nextTime.minuteOfDay,
      currentPeriod: nextTime.currentPeriod
    }
  ];

  if (previousTime.dayNumber !== nextTime.dayNumber || previousTime.currentPeriod !== nextTime.currentPeriod) {
    events.push({
      kind: "period-changed",
      dayNumber: nextTime.dayNumber,
      period: nextTime.currentPeriod
    });
  }

  if (nextTime.dayNumber !== previousTime.dayNumber) {
    for (let dayNumber = previousTime.dayNumber + 1; dayNumber <= nextTime.dayNumber; dayNumber++) {
      events.push({
        kind: "day-changed",
        dayNumber
      });
    }
  }

  return {
    world: {
      ...world,
      time: nextTime
    },
    elapsedSimulationSeconds: effectiveDeltaSeconds,
    events
  };
}

/**
 * 按格键清除玩家任务标记：移除对应 {@link MarkerSnapshot}，并对仅被这些标记引用的未领取工单做清理。
 */
export function clearTaskMarkersAtCells(
  world: WorldCore,
  cellKeys: ReadonlySet<string>
): WorldCore {
  const nextWorld = cloneWorld(world);
  const removedWorkIds = new Set<string>();
  for (const [markerId, marker] of nextWorld.markers) {
    if (!cellKeys.has(coordKey(marker.cell))) continue;
    nextWorld.markers.delete(markerId);
    removedWorkIds.add(marker.workItemId);
  }

  for (const workId of removedWorkIds) {
    const stillReferenced = [...nextWorld.markers.values()].some((m) => m.workItemId === workId);
    if (stillReferenced) continue;

    const work = nextWorld.workItems.get(workId);
    if (!work || work.status !== "open") continue;
    if (work.claimedBy) continue;

    nextWorld.workItems.delete(workId);
    if (work.targetEntityId) {
      const ent = nextWorld.entities.get(work.targetEntityId);
      if (ent) {
        nextWorld.entities.set(work.targetEntityId, {
          ...ent,
          relatedWorkItemIds: ent.relatedWorkItemIds.filter((id) => id !== workId)
        });
      }
    }
  }

  return nextWorld;
}

export function placeTaskMarker(
  world: WorldCore,
  input: Readonly<{
    kind: "deconstruct-obstacle";
    cell: GridCoord;
    targetEntityId: string;
  }>
): Readonly<{ world: WorldCore; markerId: string; workItemId: string }> {
  const nextWorld = cloneWorld(world);
  const existingWorkItem = findExistingWorkItem(nextWorld, "deconstruct-obstacle", input.targetEntityId);
  const workItemId = existingWorkItem?.id ?? makeWorkItemId(nextWorld);
  if (!existingWorkItem) {
    nextWorld.nextWorkItemId += 1;
    nextWorld.workItems.set(workItemId, {
      id: workItemId,
      kind: "deconstruct-obstacle",
      anchorCell: input.cell,
      targetEntityId: input.targetEntityId,
      status: "open",
      failureCount: 0
    });
  }

  attachWorkItemToEntityMutable(nextWorld, input.targetEntityId, workItemId);

  const markerId = makeMarkerId(nextWorld);
  nextWorld.nextMarkerId += 1;
  nextWorld.markers.set(markerId, {
    id: markerId,
    kind: input.kind,
    cell: input.cell,
    targetEntityId: input.targetEntityId,
    workItemId
  });

  return {
    world: nextWorld,
    markerId,
    workItemId
  };
}

export function safePlaceBlueprint(
  world: WorldCore,
  input: Readonly<{
    buildingKind: BuildingKind;
    cell: GridCoord;
    occupiedCells?: readonly GridCoord[];
  }>
): Readonly<
  | { ok: true; world: WorldCore; blueprintEntityId: string; workItemId: string }
  | { ok: false; world: WorldCore; reason: string }
> {
  const spawned = spawnWorldEntity(world, {
    kind: "blueprint",
    cell: input.cell,
    occupiedCells: input.occupiedCells ?? [input.cell],
    blueprintKind: input.buildingKind,
    label: `${input.buildingKind}-blueprint`,
    buildProgress01: 0,
    buildState: "planned"
  });
  if (spawned.outcome.kind !== "created") {
    const reason =
      spawned.outcome.kind === "conflict"
        ? `与实体 ${spawned.outcome.blockingEntityId} 占用冲突`
        : spawned.outcome.kind === "out-of-bounds"
          ? "蓝图超出地图边界"
          : "无法放置蓝图";
    return { ok: false, world, reason };
  }

  const nextWorld = cloneWorld(spawned.world);
  const existingWorkItem = findExistingWorkItem(nextWorld, "construct-blueprint", spawned.entityId);
  const workItemId = existingWorkItem?.id ?? makeWorkItemId(nextWorld);
  if (!existingWorkItem) {
    nextWorld.nextWorkItemId += 1;
    nextWorld.workItems.set(workItemId, {
      id: workItemId,
      kind: "construct-blueprint",
      anchorCell: input.cell,
      targetEntityId: spawned.entityId,
      status: "open",
      failureCount: 0
    });
  }
  attachWorkItemToEntityMutable(nextWorld, spawned.entityId, workItemId);

  return {
    ok: true,
    world: nextWorld,
    blueprintEntityId: spawned.entityId,
    workItemId
  };
}

export function placeBlueprint(
  world: WorldCore,
  input: Readonly<{
    buildingKind: BuildingKind;
    cell: GridCoord;
    occupiedCells?: readonly GridCoord[];
  }>
): Readonly<{ world: WorldCore; blueprintEntityId: string; workItemId: string }> {
  const r = safePlaceBlueprint(world, input);
  if (!r.ok) {
    throw new Error(`world-core: failed to place blueprint: ${r.reason}`);
  }
  return { world: r.world, blueprintEntityId: r.blueprintEntityId, workItemId: r.workItemId };
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

function completeDeconstructWork(
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

function completeBlueprintWork(
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
