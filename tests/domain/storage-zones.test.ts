import { describe, expect, it } from "vitest";
import type { ResourceMaterialKind } from "../../src/game/entity/entity-types";
import {
  createWorldCore,
  spawnWorldEntity
} from "../../src/game/world-core";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import {
  findAvailableStorageCell,
  listStorageGroupLabels,
  resolveStorageGroupAtCell,
  storageCellLockedMaterial
} from "../../src/game/map/storage-zones";

function spawnStorageZone(world: ReturnType<typeof createWorldCore>, cells: readonly { col: number; row: number }[]) {
  const spawned = spawnWorldEntity(world, {
    kind: "zone",
    cell: cells[0]!,
    occupiedCells: [],
    coveredCells: cells,
    zoneKind: "storage",
    acceptedMaterialKinds: [],
    label: "存储区"
  });
  expect(spawned.outcome.kind).toBe("created");
  return spawned;
}

function spawnResource(
  world: ReturnType<typeof createWorldCore>,
  params: {
    cell: { col: number; row: number };
    materialKind: ResourceMaterialKind;
    containerKind: "ground" | "pawn" | "zone";
    containerEntityId?: string;
    carriedByPawnId?: string;
    stackCount?: number;
    stackable?: boolean;
    occupiedCells?: readonly { col: number; row: number }[];
  }
) {
  const spawned = spawnWorldEntity(world, {
    kind: "resource",
    cell: params.cell,
    materialKind: params.materialKind,
    containerKind: params.containerKind,
    containerEntityId: params.containerEntityId,
    carriedByPawnId: params.carriedByPawnId,
    stackCount: params.stackCount,
    stackable: params.stackable,
    occupiedCells: params.occupiedCells,
    pickupAllowed: true
  });
  expect(spawned.outcome.kind).toBe("created");
  return spawned;
}

describe("storage-zones query helpers", () => {
  it("groups 4-neighbor connected storage zones into one label anchor", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const a = spawnStorageZone(world, [
      { col: 5, row: 5 },
      { col: 6, row: 5 }
    ]);
    world = a.world;
    const b = spawnStorageZone(world, [
      { col: 6, row: 6 },
      { col: 7, row: 6 }
    ]);
    world = b.world;

    const labels = listStorageGroupLabels(world);

    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({
      text: "存储区",
      anchorCell: { col: 5, row: 5 }
    });

    const group = resolveStorageGroupAtCell(world, { col: 7, row: 6 });
    expect(group).toBeDefined();
    expect(group?.cells).toEqual([
      { col: 5, row: 5 },
      { col: 6, row: 5 },
      { col: 6, row: 6 },
      { col: 7, row: 6 }
    ]);
  });

  it("keeps separated storage zones as different label groups", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const a = spawnStorageZone(world, [{ col: 1, row: 1 }]);
    world = a.world;
    const b = spawnStorageZone(world, [{ col: 4, row: 1 }]);
    world = b.world;

    const labels = listStorageGroupLabels(world);

    expect(labels).toHaveLength(2);
    expect(labels.map((label) => label.anchorCell)).toEqual([
      { col: 1, row: 1 },
      { col: 4, row: 1 }
    ]);
  });

  it("locks a storage cell to the first stored material and unlocks empty cells", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const zone = spawnStorageZone(world, [{ col: 8, row: 3 }]);
    world = zone.world;

    expect(storageCellLockedMaterial(world, { col: 8, row: 3 })).toBeUndefined();

    const wood = spawnResource(world, {
      cell: { col: 8, row: 3 },
      materialKind: "wood",
      containerKind: "zone",
      containerEntityId: zone.entityId,
      stackCount: 5
    });
    world = wood.world;

    expect(storageCellLockedMaterial(world, { col: 8, row: 3 })).toBe("wood");
  });

  it("finds an existing compatible stack before using an empty slot", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const zone = spawnStorageZone(world, [
      { col: 10, row: 4 },
      { col: 11, row: 4 }
    ]);
    world = zone.world;

    const stored = spawnResource(world, {
      cell: { col: 10, row: 4 },
      materialKind: "wood",
      containerKind: "zone",
      containerEntityId: zone.entityId,
      stackCount: 3,
      stackable: true
    });
    world = stored.world;

    const carried = spawnResource(world, {
      cell: { col: 2, row: 2 },
      materialKind: "wood",
      containerKind: "pawn",
      carriedByPawnId: "pawn-a",
      containerEntityId: "pawn-a",
      stackCount: 2,
      stackable: true,
      occupiedCells: []
    });
    world = carried.world;

    expect(findAvailableStorageCell(world, carried.entityId)).toMatchObject({
      cell: { col: 10, row: 4 },
      zoneId: zone.entityId
    });
  });

  it("skips incompatible locked cells and chooses another empty storage cell", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const zone = spawnStorageZone(world, [
      { col: 12, row: 4 },
      { col: 13, row: 4 }
    ]);
    world = zone.world;

    const food = spawnResource(world, {
      cell: { col: 12, row: 4 },
      materialKind: "food",
      containerKind: "zone",
      containerEntityId: zone.entityId,
      stackCount: 6
    });
    world = food.world;

    const carried = spawnResource(world, {
      cell: { col: 2, row: 2 },
      materialKind: "wood",
      containerKind: "pawn",
      carriedByPawnId: "pawn-a",
      containerEntityId: "pawn-a",
      stackCount: 1,
      stackable: false,
      occupiedCells: []
    });
    world = carried.world;

    expect(findAvailableStorageCell(world, carried.entityId)).toMatchObject({
      cell: { col: 13, row: 4 },
      zoneId: zone.entityId
    });
  });

  it("returns undefined when every storage cell is unavailable", () => {
    let world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const zone = spawnStorageZone(world, [{ col: 15, row: 4 }]);
    world = zone.world;

    const blocking = spawnResource(world, {
      cell: { col: 15, row: 4 },
      materialKind: "food",
      containerKind: "zone",
      containerEntityId: zone.entityId,
      stackCount: 1,
      stackable: false
    });
    world = blocking.world;

    const carried = spawnResource(world, {
      cell: { col: 3, row: 3 },
      materialKind: "wood",
      containerKind: "pawn",
      carriedByPawnId: "pawn-a",
      containerEntityId: "pawn-a",
      stackCount: 1,
      stackable: false,
      occupiedCells: []
    });
    world = carried.world;

    expect(findAvailableStorageCell(world, carried.entityId)).toBeUndefined();
  });
});
