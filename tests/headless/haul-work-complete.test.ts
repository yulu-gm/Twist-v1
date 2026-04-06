import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import {
  claimWorkItem,
  completeWorkItem,
  createWorldCore,
  spawnWorldEntity
} from "../../src/game/world-core";

describe("completeHaulWork（WorldCore 直接工单完成）", () => {
  it("resource 由 pawn 携带 + storage zone + haul-to-zone 认领 → completeWorkItem → 存入 zone", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const pawnCell = { col: 5, row: 5 };
    const dropCell = { col: 10, row: 5 };

    const pawnSpawn = spawnWorldEntity(world, {
      kind: "pawn",
      cell: pawnCell,
      occupiedCells: [{ col: pawnCell.col, row: pawnCell.row }],
      label: "hauler"
    });
    expect(pawnSpawn.outcome.kind).toBe("created");
    world = pawnSpawn.world;
    const pawnId = pawnSpawn.entityId;

    const resourceSpawn = spawnWorldEntity(world, {
      kind: "resource",
      cell: { ...pawnCell },
      occupiedCells: [],
      materialKind: "wood",
      containerKind: "pawn",
      containerEntityId: pawnId,
      carriedByPawnId: pawnId,
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
    const zoneId = zoneSpawn.entityId;

    const haulId = "work-haul-test";
    world.workItems.set(haulId, {
      id: haulId,
      kind: "haul-to-zone",
      anchorCell: { ...dropCell },
      targetEntityId: resourceId,
      status: "open",
      failureCount: 0,
      haulTargetZoneId: zoneId,
      haulDropCell: { ...dropCell }
    });

    const claimed = claimWorkItem(world, haulId, pawnId);
    expect(claimed.outcome.kind).toBe("claimed");

    const completed = completeWorkItem(claimed.world, haulId, pawnId);
    expect(completed?.outcome.kind).toBe("completed");

    const finalWorld = completed!.world;
    const resource = finalWorld.entities.get(resourceId);
    expect(resource?.kind).toBe("resource");
    expect(resource?.containerKind).toBe("zone");
    expect(resource?.containerEntityId).toBe(zoneId);
    expect(resource?.cell).toEqual(dropCell);
    expect(resource?.carriedByPawnId).toBeUndefined();

    const haul = finalWorld.workItems.get(haulId);
    expect(haul?.status).toBe("completed");
  });
});
