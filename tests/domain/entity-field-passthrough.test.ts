import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_GRID } from "../../src/game/map/world-grid";
import { createEntity, upsertEntityMutable } from "../../src/game/world-internal";
import type { EntityDraft } from "../../src/game/world-core-types";
import { createWorldCore, getWorldSnapshot } from "../../src/game/world-core";

describe("entity draft → snapshot field passthrough", () => {
  it("createEntity copies all T-01 draft fields onto WorldEntitySnapshot", () => {
    const world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const draft: EntityDraft = {
      kind: "resource",
      cell: { row: 1, col: 2 },
      occupiedCells: [{ row: 1, col: 2 }],
      materialKind: "wood",
      containerKind: "ground",
      containerEntityId: "container-ent-1",
      loggingMarked: true,
      zoneKind: "storage",
      coveredCells: [{ row: 0, col: 0 }],
      pickupAllowed: true,
      carriedByPawnId: "p1",
      reservedByPawnId: "p2",
      acceptedMaterialKinds: ["wood"]
    };

    const entity = createEntity(world, draft);

    expect(entity.materialKind).toBe("wood");
    expect(entity.containerKind).toBe("ground");
    expect(entity.containerEntityId).toBe("container-ent-1");
    expect(entity.loggingMarked).toBe(true);
    expect(entity.zoneKind).toBe("storage");
    expect(entity.coveredCells).toEqual([{ row: 0, col: 0 }]);
    expect(entity.pickupAllowed).toBe(true);
    expect(entity.carriedByPawnId).toBe("p1");
    expect(entity.reservedByPawnId).toBe("p2");
    expect(entity.acceptedMaterialKinds).toEqual(["wood"]);

    expect(entity.coveredCells).not.toBe(draft.coveredCells);
    expect(entity.acceptedMaterialKinds).not.toBe(draft.acceptedMaterialKinds);
  });

  it("getWorldSnapshot preserves new entity fields on the entities array", () => {
    const world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const draft: EntityDraft = {
      kind: "resource",
      cell: { row: 3, col: 4 },
      occupiedCells: [{ row: 3, col: 4 }],
      materialKind: "wood",
      containerKind: "ground",
      containerEntityId: "container-ent-1",
      loggingMarked: true,
      zoneKind: "storage",
      coveredCells: [{ row: 0, col: 0 }],
      pickupAllowed: true,
      carriedByPawnId: "p1",
      reservedByPawnId: "p2",
      acceptedMaterialKinds: ["wood"]
    };

    const entity = createEntity(world, draft);
    upsertEntityMutable(world, entity);

    const snap = getWorldSnapshot(world);
    const out = snap.entities.find((e) => e.id === entity.id);
    expect(out).toBeDefined();

    expect(out!.materialKind).toBe("wood");
    expect(out!.containerKind).toBe("ground");
    expect(out!.containerEntityId).toBe("container-ent-1");
    expect(out!.loggingMarked).toBe(true);
    expect(out!.zoneKind).toBe("storage");
    expect(out!.coveredCells).toEqual([{ row: 0, col: 0 }]);
    expect(out!.pickupAllowed).toBe(true);
    expect(out!.carriedByPawnId).toBe("p1");
    expect(out!.reservedByPawnId).toBe("p2");
    expect(out!.acceptedMaterialKinds).toEqual(["wood"]);

    const stored = world.entities.get(entity.id)!;
    expect(out!.coveredCells).not.toBe(stored.coveredCells);
    expect(out!.acceptedMaterialKinds).not.toBe(stored.acceptedMaterialKinds);
  });

  it("does not invent defaults when T-01 draft fields are omitted", () => {
    const world = createWorldCore({ grid: DEFAULT_WORLD_GRID });
    const draft: EntityDraft = {
      kind: "obstacle",
      cell: { row: 0, col: 0 }
    };

    const entity = createEntity(world, draft);

    expect(entity.materialKind).toBeUndefined();
    expect(entity.containerKind).toBeUndefined();
    expect(entity.containerEntityId).toBeUndefined();
    expect(entity.loggingMarked).toBeUndefined();
    expect(entity.zoneKind).toBeUndefined();
    expect(entity.coveredCells).toBeUndefined();
    expect(entity.pickupAllowed).toBeUndefined();
    expect(entity.carriedByPawnId).toBeUndefined();
    expect(entity.reservedByPawnId).toBeUndefined();
    expect(entity.acceptedMaterialKinds).toBeUndefined();
  });
});
