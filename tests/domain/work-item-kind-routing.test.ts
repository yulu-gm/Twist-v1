import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import { completeWorkItem, createWorldCore, spawnWorldEntity } from "../../src/game/world-core";
import type { WorkItemSnapshot } from "../../src/game/world-core";

function worldWithClaimedWork(item: WorkItemSnapshot) {
  const world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
  world.workItems.set(item.id, item);
  return world;
}

describe("completeWorkItem kind routing", () => {
  it("routes chop-tree：无目标树时为 target-missing", () => {
    const item: WorkItemSnapshot = {
      id: "w-1",
      kind: "chop-tree",
      anchorCell: { col: 0, row: 0 },
      status: "claimed",
      claimedBy: "pawn-a",
      failureCount: 0
    };
    const result = completeWorkItem(worldWithClaimedWork(item), "w-1", "pawn-a");
    expect(result?.outcome.kind).toBe("target-missing");
  });

  it("routes chop-tree：有树则 completed", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const spawned = spawnWorldEntity(world, {
      kind: "tree",
      cell: { col: 3, row: 3 },
      occupiedCells: [],
      loggingMarked: true
    });
    expect(spawned.outcome.kind).toBe("created");
    world = spawned.world;
    const treeId = spawned.entityId;
    const item: WorkItemSnapshot = {
      id: "w-chop",
      kind: "chop-tree",
      anchorCell: { col: 3, row: 3 },
      targetEntityId: treeId,
      status: "claimed",
      claimedBy: "pawn-a",
      failureCount: 0
    };
    world.workItems.set(item.id, item);
    const result = completeWorkItem(world, "w-chop", "pawn-a");
    expect(result?.outcome.kind).toBe("completed");
  });

  it("routes pick-up-resource：有地面物资则 completed", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const spawned = spawnWorldEntity(world, {
      kind: "resource",
      cell: { col: 1, row: 1 },
      materialKind: "wood",
      containerKind: "ground",
      pickupAllowed: true
    });
    expect(spawned.outcome.kind).toBe("created");
    world = spawned.world;
    const resourceId = spawned.entityId;
    const item: WorkItemSnapshot = {
      id: "w-pick",
      kind: "pick-up-resource",
      anchorCell: { col: 1, row: 1 },
      targetEntityId: resourceId,
      status: "claimed",
      claimedBy: "pawn-a",
      failureCount: 0
    };
    world.workItems.set(item.id, item);
    const result = completeWorkItem(world, "w-pick", "pawn-a");
    expect(result?.outcome.kind).toBe("completed");
  });

  it("routes haul-to-zone：有资源与存储区则 completed", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const z = spawnWorldEntity(world, {
      kind: "zone",
      cell: { col: 2, row: 3 },
      zoneKind: "storage",
      coveredCells: [{ col: 2, row: 3 }]
    });
    expect(z.outcome.kind).toBe("created");
    world = z.world;
    const zoneId = z.entityId;
    const r = spawnWorldEntity(world, {
      kind: "resource",
      cell: { col: 0, row: 0 },
      materialKind: "wood",
      containerKind: "pawn",
      carriedByPawnId: "pawn-a",
      occupiedCells: [],
      pickupAllowed: true
    });
    expect(r.outcome.kind).toBe("created");
    world = r.world;
    const resourceId = r.entityId;
    const item: WorkItemSnapshot = {
      id: "w-1",
      kind: "haul-to-zone",
      anchorCell: { col: 2, row: 3 },
      targetEntityId: resourceId,
      status: "claimed",
      claimedBy: "pawn-a",
      failureCount: 0,
      haulTargetZoneId: zoneId,
      haulDropCell: { col: 2, row: 3 },
      derivedFromWorkId: "parent-work"
    };
    world.workItems.set(item.id, item);
    const result = completeWorkItem(world, "w-1", "pawn-a");
    expect(result?.outcome.kind).toBe("completed");
  });

  it("unknown runtime kind falls through switch and returns undefined (no throw)", () => {
    const world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const tampered = {
      id: "w-bad",
      kind: "not-a-valid-kind",
      anchorCell: { col: 0, row: 0 },
      status: "claimed" as const,
      claimedBy: "pawn-a",
      failureCount: 0
    } as unknown as WorkItemSnapshot;
    world.workItems.set("w-bad", tampered);
    const result = completeWorkItem(world, "w-bad", "pawn-a");
    expect(result).toBeUndefined();
  });
});
