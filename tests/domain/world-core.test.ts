import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_CONTROL_STATE } from "../../src/game/time-of-day";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/world-grid";
import {
  advanceWorldClock,
  claimWorkItem,
  completeWorkItem,
  createWorldCore,
  failWorkItem,
  getWorldSnapshot,
  placeBlueprint,
  placeTaskMarker,
  removeWorldEntity,
  spawnWorldEntity,
  moveWorldEntity
} from "../../src/game/world-core";

function findEntity(snapshot: ReturnType<typeof getWorldSnapshot>, entityId: string) {
  return snapshot.entities.find((entity) => entity.id === entityId);
}

function findWorkItem(snapshot: ReturnType<typeof getWorldSnapshot>, workItemId: string) {
  return snapshot.workItems.find((workItem) => workItem.id === workItemId);
}

function findMarker(snapshot: ReturnType<typeof getWorldSnapshot>, markerId: string) {
  return snapshot.markers.find((marker) => marker.id === markerId);
}

describe("world-core A-M1", () => {
  it("keeps entity snapshots and occupancy in sync across create move and remove", () => {
    const created = spawnWorldEntity(createWorldCore({ grid: DEFAULT_WORLD_GRID }), {
      kind: "pawn",
      cell: { col: 2, row: 2 },
      occupiedCells: [{ col: 2, row: 2 }],
      label: "Alex"
    });

    expect(created.outcome.kind).toBe("created");
    const createdSnapshot = getWorldSnapshot(created.world);
    expect(findEntity(createdSnapshot, created.entityId)?.label).toBe("Alex");
    expect(createdSnapshot.occupancy[coordKey({ col: 2, row: 2 })]).toBe(created.entityId);

    const moved = moveWorldEntity(created.world, created.entityId, { col: 3, row: 2 });

    expect(moved.outcome.kind).toBe("moved");
    const movedSnapshot = getWorldSnapshot(moved.world);
    expect(findEntity(movedSnapshot, created.entityId)?.cell).toEqual({ col: 3, row: 2 });
    expect(movedSnapshot.occupancy[coordKey({ col: 2, row: 2 })]).toBeUndefined();
    expect(movedSnapshot.occupancy[coordKey({ col: 3, row: 2 })]).toBe(created.entityId);

    const removed = removeWorldEntity(moved.world, created.entityId);

    expect(removed.outcome.kind).toBe("removed");
    const removedSnapshot = getWorldSnapshot(removed.world);
    expect(findEntity(removedSnapshot, created.entityId)).toBeUndefined();
    expect(removedSnapshot.occupancy[coordKey({ col: 3, row: 2 })]).toBeUndefined();
  });

  it("returns a serializable snapshot that does not expose mutable world internals", () => {
    const created = spawnWorldEntity(createWorldCore({ grid: DEFAULT_WORLD_GRID }), {
      kind: "pawn",
      cell: { col: 1, row: 1 },
      label: "Alex"
    });

    const snapshot = getWorldSnapshot(created.world);
    const serialized = JSON.parse(JSON.stringify(snapshot));

    expect(serialized).toMatchObject({
      time: {
        dayNumber: 1,
        paused: false,
        speed: 1
      }
    });
    expect(serialized.entities).toEqual([
      expect.objectContaining({
        id: created.entityId,
        kind: "pawn",
        label: "Alex"
      })
    ]);

    (snapshot.entities as unknown as Array<(typeof snapshot.entities)[number]>).push({
      id: "tampered",
      kind: "pawn",
      cell: { col: 0, row: 0 },
      occupiedCells: [{ col: 0, row: 0 }],
      relatedWorkItemIds: []
    });
    (snapshot.occupancy as Record<string, string>)["9,9"] = "tampered";

    const freshSnapshot = getWorldSnapshot(created.world);
    expect(findEntity(freshSnapshot, "tampered")).toBeUndefined();
    expect(freshSnapshot.occupancy["9,9"]).toBeUndefined();
  });

  it("does not advance time while paused and emits time slice, period, and day events when the clock crosses midnight", () => {
    const world = createWorldCore({
      grid: DEFAULT_WORLD_GRID,
      timeState: {
        dayNumber: 1,
        minuteOfDay: 23 * 60 + 50
      },
      timeConfig: {
        realSecondsPerDay: 24,
        startMinuteOfDay: 0
      }
    });

    const paused = advanceWorldClock(world, 0.5, {
      paused: true,
      speed: 3
    });
    expect(paused.elapsedSimulationSeconds).toBe(0);
    expect(paused.events).toEqual([]);
    expect(getWorldSnapshot(paused.world).time.dayNumber).toBe(1);
    expect(getWorldSnapshot(paused.world).time.minuteOfDay).toBe(23 * 60 + 50);
    expect(getWorldSnapshot(paused.world).time.paused).toBe(true);
    expect(getWorldSnapshot(paused.world).time.speed).toBe(3);
    expect(getWorldSnapshot(paused.world).time.currentPeriod).toBe("night");

    const running = advanceWorldClock(world, 0.5, DEFAULT_TIME_CONTROL_STATE);

    expect(running.elapsedSimulationSeconds).toBe(0.5);
    expect(getWorldSnapshot(running.world).time).toEqual({
      dayNumber: 2,
      minuteOfDay: 20,
      dayProgress01: 20 / (24 * 60),
      currentPeriod: "night",
      paused: false,
      speed: 1
    });
    expect(running.events).toEqual([
      {
        kind: "time-advanced",
        dayNumber: 2,
        minuteOfDay: 20,
        currentPeriod: "night"
      },
      {
        kind: "period-changed",
        dayNumber: 2,
        period: "night"
      },
      {
        kind: "day-changed",
        dayNumber: 2
      }
    ]);
  });
});

describe("world-core A-M2", () => {
  it("turns a marker into claimable work, enforces the lock, and updates the world on completion", () => {
    const seeded = spawnWorldEntity(createWorldCore({ grid: DEFAULT_WORLD_GRID }), {
      kind: "obstacle",
      cell: { col: 6, row: 4 },
      occupiedCells: [{ col: 6, row: 4 }],
      label: "stone"
    });
    const markerPlaced = placeTaskMarker(seeded.world, {
      kind: "deconstruct-obstacle",
      cell: { col: 6, row: 4 },
      targetEntityId: seeded.entityId
    });

    expect(markerPlaced.workItemId).toBeTruthy();
    expect(findWorkItem(getWorldSnapshot(markerPlaced.world), markerPlaced.workItemId)?.status).toBe("open");

    const claimed = claimWorkItem(markerPlaced.world, markerPlaced.workItemId, "pawn-a");
    expect(claimed.outcome.kind).toBe("claimed");
    expect(findWorkItem(getWorldSnapshot(claimed.world), markerPlaced.workItemId)?.claimedBy).toBe("pawn-a");

    const denied = claimWorkItem(claimed.world, markerPlaced.workItemId, "pawn-b");
    expect(denied.outcome.kind).toBe("already-claimed");

    const completed = completeWorkItem(claimed.world, markerPlaced.workItemId, "pawn-a");
    expect(completed.outcome.kind).toBe("completed");
    const snapshot = getWorldSnapshot(completed.world);
    expect(findEntity(snapshot, seeded.entityId)).toBeUndefined();
    expect(findMarker(snapshot, markerPlaced.markerId)).toBeUndefined();
    expect(findWorkItem(snapshot, markerPlaced.workItemId)?.status).toBe("completed");
    expect(snapshot.occupancy[coordKey({ col: 6, row: 4 })]).toBeUndefined();
  });

  it("reopens failed work and lets another pawn retry it", () => {
    const blueprintPlaced = placeBlueprint(createWorldCore({ grid: DEFAULT_WORLD_GRID }), {
      buildingKind: "bed",
      cell: { col: 9, row: 6 }
    });

    const claimed = claimWorkItem(blueprintPlaced.world, blueprintPlaced.workItemId, "pawn-a");
    const failed = failWorkItem(claimed.world, blueprintPlaced.workItemId, "pawn-a", "too-far");

    expect(failed.outcome.kind).toBe("failed");
    const failedSnapshot = getWorldSnapshot(failed.world);
    expect(findWorkItem(failedSnapshot, blueprintPlaced.workItemId)?.status).toBe("open");
    expect(findWorkItem(failedSnapshot, blueprintPlaced.workItemId)?.claimedBy).toBeUndefined();
    expect(findWorkItem(failedSnapshot, blueprintPlaced.workItemId)?.failureCount).toBe(1);

    const retried = claimWorkItem(failed.world, blueprintPlaced.workItemId, "pawn-b");
    expect(retried.outcome.kind).toBe("claimed");
    expect(findWorkItem(getWorldSnapshot(retried.world), blueprintPlaced.workItemId)?.claimedBy).toBe("pawn-b");
  });

  it("deduplicates repeated marker work and keeps reverse links from the target entity", () => {
    const seeded = spawnWorldEntity(createWorldCore({ grid: DEFAULT_WORLD_GRID }), {
      kind: "obstacle",
      cell: { col: 7, row: 4 },
      occupiedCells: [{ col: 7, row: 4 }],
      label: "stone"
    });

    const first = placeTaskMarker(seeded.world, {
      kind: "deconstruct-obstacle",
      cell: { col: 7, row: 4 },
      targetEntityId: seeded.entityId
    });
    const second = placeTaskMarker(first.world, {
      kind: "deconstruct-obstacle",
      cell: { col: 7, row: 4 },
      targetEntityId: seeded.entityId
    });

    expect(second.workItemId).toBe(first.workItemId);
    const snapshot = getWorldSnapshot(second.world);
    expect(snapshot.workItems.filter((workItem) => workItem.targetEntityId === seeded.entityId)).toHaveLength(1);
    expect(findEntity(snapshot, seeded.entityId)?.relatedWorkItemIds).toEqual([first.workItemId]);
  });

  it("turns a completed bed blueprint into a building entity and a rest spot result", () => {
    const blueprintPlaced = placeBlueprint(createWorldCore({ grid: DEFAULT_WORLD_GRID }), {
      buildingKind: "bed",
      cell: { col: 10, row: 6 }
    });
    const blueprintSnapshot = getWorldSnapshot(blueprintPlaced.world);
    expect(findEntity(blueprintSnapshot, blueprintPlaced.blueprintEntityId)).toEqual(
      expect.objectContaining({
        kind: "blueprint",
        blueprintKind: "bed",
        buildState: "planned",
        buildProgress01: 0,
        relatedWorkItemIds: [blueprintPlaced.workItemId]
      })
    );

    const claimed = claimWorkItem(blueprintPlaced.world, blueprintPlaced.workItemId, "pawn-a");
    const completed = completeWorkItem(claimed.world, blueprintPlaced.workItemId, "pawn-a");
    if (completed.outcome.kind !== "completed" || !completed.outcome.createdEntityId) {
      throw new Error(`expected completed build result, got ${completed.outcome.kind}`);
    }

    const snapshot = getWorldSnapshot(completed.world);
    expect(findEntity(snapshot, blueprintPlaced.blueprintEntityId)).toBeUndefined();
    const builtEntity = findEntity(snapshot, completed.outcome.createdEntityId);
    expect(builtEntity?.kind).toBe("building");
    expect(builtEntity?.buildingKind).toBe("bed");
    expect(builtEntity?.interactionCapabilities).toEqual(["rest"]);
    expect(builtEntity?.ownership).toEqual({
      ownerPawnId: undefined,
      assignmentReason: "unassigned"
    });
    expect(snapshot.occupancy[coordKey({ col: 10, row: 6 })]).toBe(completed.outcome.createdEntityId);
    expect(snapshot.restSpots).toEqual([
      {
        buildingEntityId: completed.outcome.createdEntityId,
        cell: { col: 10, row: 6 },
        ownerPawnId: undefined,
        assignmentReason: "unassigned"
      }
    ]);
  });
});
