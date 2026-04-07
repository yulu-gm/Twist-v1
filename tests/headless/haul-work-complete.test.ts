/**
 * refactor-test：WorldCore 直调工单完成回归；不承担 ENTITY-002 玩家路径主验收。
 * 主证据：`chop-haul-full-chain.scenario.ts` + `chop-haul-full-chain.test.ts` / `scenario-runner.test.ts`。
 */
import { describe, expect, it } from "vitest";
import { coordKey, DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
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
      priority: 6,
      sourceReason: "test",
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

  it("当认领后的计划 storage 槽位失效时，会在 pawn 当前格重开 haul，而不会静默改投到别的槽位", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const pawnCell = { col: 5, row: 5 };
    const dropCell = { col: 10, row: 5 };
    const secondCell = { col: 11, row: 5 };

    const pawnSpawn = spawnWorldEntity(world, {
      kind: "pawn",
      cell: pawnCell,
      occupiedCells: [{ col: pawnCell.col, row: pawnCell.row }],
      label: "hauler"
    });
    expect(pawnSpawn.outcome.kind).toBe("created");
    world = pawnSpawn.world;
    const pawnId = pawnSpawn.entityId;

    const carriedSpawn = spawnWorldEntity(world, {
      kind: "resource",
      cell: { ...pawnCell },
      occupiedCells: [],
      materialKind: "wood",
      containerKind: "pawn",
      containerEntityId: pawnId,
      carriedByPawnId: pawnId,
      pickupAllowed: true
    });
    expect(carriedSpawn.outcome.kind).toBe("created");
    world = carriedSpawn.world;
    const carriedId = carriedSpawn.entityId;

    const zoneSpawn = spawnWorldEntity(world, {
      kind: "zone",
      cell: { col: 10, row: 5 },
      occupiedCells: [],
      coveredCells: [dropCell, secondCell],
      zoneKind: "storage",
      acceptedMaterialKinds: []
    });
    expect(zoneSpawn.outcome.kind).toBe("created");
    world = zoneSpawn.world;
    const zoneId = zoneSpawn.entityId;
    const haulId = "work-haul-reserve-next-slot";

    world.workItems.set(haulId, {
      id: haulId,
      kind: "haul-to-zone",
      anchorCell: { ...dropCell },
      targetEntityId: carriedId,
      status: "open",
      failureCount: 0,
      priority: 6,
      sourceReason: "test",
      haulTargetZoneId: zoneId,
      haulDropCell: { ...dropCell }
    });

    const claimed = claimWorkItem(world, haulId, pawnId);
    expect(claimed.outcome.kind).toBe("claimed");

    const storedSpawn = spawnWorldEntity(claimed.world, {
      kind: "resource",
      cell: { ...dropCell },
      occupiedCells: [],
      materialKind: "food",
      containerKind: "zone",
      containerEntityId: zoneId,
      pickupAllowed: false,
      stackable: false
    });
    expect(storedSpawn.outcome.kind).toBe("created");
    world = storedSpawn.world;
    const storedId = storedSpawn.entityId;

    const completed = completeWorkItem(world, haulId, pawnId);
    expect(completed?.outcome.kind).toBe("haul-reopened");

    const finalWorld = completed!.world;
    const carried = finalWorld.entities.get(carriedId);
    expect(carried?.kind).toBe("resource");
    expect(carried?.containerKind).toBe("ground");
    expect(carried?.containerEntityId).toBeUndefined();
    expect(carried?.cell).toEqual(pawnCell);
    expect(carried?.carriedByPawnId).toBeUndefined();

    const alreadyStored = finalWorld.entities.get(storedId);
    expect(alreadyStored?.kind).toBe("resource");
    expect(alreadyStored?.containerKind).toBe("zone");
    expect(alreadyStored?.cell).toEqual(dropCell);

    const zoneResources = [...finalWorld.entities.values()].filter(
      (entity) =>
        entity.kind === "resource" &&
        entity.containerKind === "zone" &&
        entity.containerEntityId === zoneId
    );
    expect(zoneResources).toHaveLength(1);

    const haul = finalWorld.workItems.get(haulId);
    expect(haul?.status).toBe("open");
    expect(haul?.claimedBy).toBeUndefined();
    expect(haul?.failureCount).toBe(1);
    expect(haul?.haulTargetZoneId).toBe(zoneId);
    expect(haul?.haulDropCell).toEqual(dropCell);
    expect(finalWorld.occupancy.get(coordKey(dropCell))).toBeUndefined();
    expect(finalWorld.occupancy.get(coordKey(secondCell))).toBeUndefined();
  });

  it("haul 重开后若资源并未由认领 pawn 携带，则不会把地面物资直接完成进 storage", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const pawnCell = { col: 7, row: 7 };
    const dropCell = { col: 12, row: 7 };

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
      containerKind: "ground",
      pickupAllowed: true
    });
    expect(resourceSpawn.outcome.kind).toBe("created");
    world = resourceSpawn.world;
    const resourceId = resourceSpawn.entityId;

    const zoneSpawn = spawnWorldEntity(world, {
      kind: "zone",
      cell: { ...dropCell },
      occupiedCells: [],
      coveredCells: [dropCell],
      zoneKind: "storage",
      acceptedMaterialKinds: []
    });
    expect(zoneSpawn.outcome.kind).toBe("created");
    world = zoneSpawn.world;
    const zoneId = zoneSpawn.entityId;

    const haulId = "work-haul-needs-carried-resource";
    world.workItems.set(haulId, {
      id: haulId,
      kind: "haul-to-zone",
      anchorCell: { ...dropCell },
      targetEntityId: resourceId,
      status: "open",
      failureCount: 0,
      priority: 6,
      sourceReason: "test",
      haulTargetZoneId: zoneId,
      haulDropCell: { ...dropCell }
    });

    const claimed = claimWorkItem(world, haulId, pawnId);
    expect(claimed.outcome.kind).toBe("claimed");

    const completed = completeWorkItem(claimed.world, haulId, pawnId);
    expect(completed?.outcome.kind).toBe("haul-reopened");

    const finalWorld = completed!.world;
    const resource = finalWorld.entities.get(resourceId);
    expect(resource?.kind).toBe("resource");
    expect(resource?.containerKind).toBe("ground");
    expect(resource?.containerEntityId).toBeUndefined();
    expect(resource?.cell).toEqual(pawnCell);
    expect(resource?.carriedByPawnId).toBeUndefined();

    const haul = finalWorld.workItems.get(haulId);
    expect(haul?.status).toBe("open");
    expect(haul?.claimedBy).toBeUndefined();
    expect(haul?.failureCount).toBe(1);
    expect(finalWorld.occupancy.get(coordKey(dropCell))).toBeUndefined();
  });

  it("当 storage 区没有可用槽位时，会把 carried resource 丢回 pawn 当前格", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const pawnCell = { col: 6, row: 6 };
    const storageCellA = { col: 12, row: 6 };
    const storageCellB = { col: 13, row: 6 };

    const pawnSpawn = spawnWorldEntity(world, {
      kind: "pawn",
      cell: pawnCell,
      occupiedCells: [{ col: pawnCell.col, row: pawnCell.row }],
      label: "hauler"
    });
    expect(pawnSpawn.outcome.kind).toBe("created");
    world = pawnSpawn.world;
    const pawnId = pawnSpawn.entityId;

    const carriedSpawn = spawnWorldEntity(world, {
      kind: "resource",
      cell: { ...pawnCell },
      occupiedCells: [],
      materialKind: "wood",
      containerKind: "pawn",
      containerEntityId: pawnId,
      carriedByPawnId: pawnId,
      pickupAllowed: true
    });
    expect(carriedSpawn.outcome.kind).toBe("created");
    world = carriedSpawn.world;
    const carriedId = carriedSpawn.entityId;

    const zoneSpawn = spawnWorldEntity(world, {
      kind: "zone",
      cell: { ...storageCellA },
      occupiedCells: [],
      coveredCells: [storageCellA, storageCellB],
      zoneKind: "storage",
      acceptedMaterialKinds: []
    });
    expect(zoneSpawn.outcome.kind).toBe("created");
    world = zoneSpawn.world;
    const zoneId = zoneSpawn.entityId;

    const fullA = spawnWorldEntity(world, {
      kind: "resource",
      cell: { ...storageCellA },
      occupiedCells: [],
      materialKind: "food",
      containerKind: "zone",
      containerEntityId: zoneId,
      pickupAllowed: false,
      stackable: false
    });
    expect(fullA.outcome.kind).toBe("created");
    world = fullA.world;

    const fullB = spawnWorldEntity(world, {
      kind: "resource",
      cell: { ...storageCellB },
      occupiedCells: [],
      materialKind: "food",
      containerKind: "zone",
      containerEntityId: zoneId,
      pickupAllowed: false,
      stackable: false
    });
    expect(fullB.outcome.kind).toBe("created");
    world = fullB.world;

    const haulId = "work-haul-full-zone";
    world.workItems.set(haulId, {
      id: haulId,
      kind: "haul-to-zone",
      anchorCell: { ...storageCellA },
      targetEntityId: carriedId,
      status: "open",
      failureCount: 0,
      priority: 6,
      sourceReason: "test",
      haulTargetZoneId: zoneId,
      haulDropCell: { ...storageCellA }
    });

    const claimed = claimWorkItem(world, haulId, pawnId);
    expect(claimed.outcome.kind).toBe("claimed");

    const completed = completeWorkItem(claimed.world, haulId, pawnId);
    expect(completed?.outcome.kind).toBe("haul-reopened");

    const finalWorld = completed!.world;
    const carried = finalWorld.entities.get(carriedId);
    expect(carried?.kind).toBe("resource");
    expect(carried?.containerKind).toBe("ground");
    expect(carried?.containerEntityId).toBeUndefined();
    expect(carried?.cell).toEqual(pawnCell);
    expect(carried?.occupiedCells).toEqual([]);
    expect(carried?.carriedByPawnId).toBeUndefined();
    expect(finalWorld.occupancy.get(coordKey(pawnCell))?.has(pawnId)).toBe(true);

    const haul = finalWorld.workItems.get(haulId);
    expect(haul?.status).toBe("open");
    expect(haul?.failureCount).toBeGreaterThan(0);
  });
});
