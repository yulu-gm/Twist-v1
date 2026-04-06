/**
 * refactor-test：WorldCore 直调 pick-up 完成回归；不承担 ENTITY-002 主验收。
 * 主证据：`chop-haul-full-chain` 场景链 + `scenario-runner.test.ts`。
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import {
  claimWorkItem,
  completeWorkItem,
  createWorldCore,
  spawnWorldEntity
} from "../../src/game/world-core";

describe("completePickUpWork（WorldCore 直接工单完成）", () => {
  it("有 storage 区时：认领并完成 pick-up → 物资由小人携带并派生 haul-to-zone open 工单", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const resourceCell = { col: 4, row: 4 };

    const resourceSpawn = spawnWorldEntity(world, {
      kind: "resource",
      cell: resourceCell,
      materialKind: "wood",
      containerKind: "ground",
      pickupAllowed: true
    });
    expect(resourceSpawn.outcome.kind).toBe("created");
    world = resourceSpawn.world;
    const resourceId = resourceSpawn.entityId;

    const zoneSpawn = spawnWorldEntity(world, {
      kind: "zone",
      cell: { col: 10, row: 5 },
      occupiedCells: [],
      coveredCells: [
        { col: 10, row: 5 },
        { col: 11, row: 5 }
      ],
      zoneKind: "storage",
      acceptedMaterialKinds: []
    });
    expect(zoneSpawn.outcome.kind).toBe("created");
    world = zoneSpawn.world;

    const pickId = "work-pick-test";
    world.workItems.set(pickId, {
      id: pickId,
      kind: "pick-up-resource",
      anchorCell: { ...resourceCell },
      targetEntityId: resourceId,
      status: "open",
      failureCount: 0
    });

    const pawnId = "pawn-carrier";
    const claimed = claimWorkItem(world, pickId, pawnId);
    expect(claimed.outcome.kind).toBe("claimed");

    const completed = completeWorkItem(claimed.world, pickId, pawnId);
    expect(completed?.outcome.kind).toBe("completed");

    const finalWorld = completed!.world;
    const resource = finalWorld.entities.get(resourceId);
    expect(resource?.kind).toBe("resource");
    expect(resource?.containerKind).toBe("pawn");
    expect(resource?.carriedByPawnId).toBe(pawnId);
    expect(resource?.containerEntityId).toBe(pawnId);

    const hauls = [...finalWorld.workItems.values()].filter((w) => w.kind === "haul-to-zone");
    const derived = hauls.find((w) => w.status === "open" && w.derivedFromWorkId === pickId);
    expect(derived).toBeDefined();
    expect(derived!.targetEntityId).toBe(resourceId);
    expect(derived!.haulTargetZoneId).toBe(zoneSpawn.entityId);
    expect(derived!.haulDropCell).toEqual({ col: 10, row: 5 });

    const pick = finalWorld.workItems.get(pickId);
    expect(pick?.status).toBe("completed");
  });

  it("无 storage 区时：完成 pick-up 不产生 haul-to-zone 工单", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const resourceCell = { col: 2, row: 2 };

    const resourceSpawn = spawnWorldEntity(world, {
      kind: "resource",
      cell: resourceCell,
      materialKind: "wood",
      containerKind: "ground",
      pickupAllowed: true
    });
    expect(resourceSpawn.outcome.kind).toBe("created");
    world = resourceSpawn.world;
    const resourceId = resourceSpawn.entityId;

    const pickId = "work-pick-no-zone";
    world.workItems.set(pickId, {
      id: pickId,
      kind: "pick-up-resource",
      anchorCell: { ...resourceCell },
      targetEntityId: resourceId,
      status: "open",
      failureCount: 0
    });

    const pawnId = "pawn-solo";
    const claimed = claimWorkItem(world, pickId, pawnId);
    const completed = completeWorkItem(claimed.world, pickId, pawnId);
    expect(completed?.outcome.kind).toBe("completed");

    const hauls = [...completed!.world.workItems.values()].filter((w) => w.kind === "haul-to-zone");
    expect(hauls).toHaveLength(0);

    const resource = completed!.world.entities.get(resourceId);
    expect(resource?.containerKind).toBe("pawn");
    expect(resource?.carriedByPawnId).toBe(pawnId);
  });
});
