import { describe, expect, it } from "vitest";
import type { WorldEntitySnapshot } from "../../../src/game/entity/entity-types";
import { collectRenderableResourceItems } from "../../../src/scenes/renderers/ground-items-renderer";

describe("collectRenderableResourceItems", () => {
  it("includes ground and storage-zone resources and exposes a stack badge for counts greater than one", () => {
    const entities = [
      {
        id: "resource-ground",
        kind: "resource",
        cell: { col: 1, row: 1 },
        occupiedCells: [{ col: 1, row: 1 }],
        relatedWorkItemIds: [],
        materialKind: "wood",
        containerKind: "ground",
        pickupAllowed: true,
        stackCount: 1
      } as WorldEntitySnapshot,
      {
        id: "resource-zone",
        kind: "resource",
        cell: { col: 5, row: 5 },
        occupiedCells: [{ col: 5, row: 5 }],
        relatedWorkItemIds: [],
        materialKind: "food",
        containerKind: "zone",
        containerEntityId: "zone-1",
        pickupAllowed: true,
        stackCount: 4
      } as WorldEntitySnapshot,
      {
        id: "resource-pawn",
        kind: "resource",
        cell: { col: 8, row: 8 },
        occupiedCells: [{ col: 8, row: 8 }],
        relatedWorkItemIds: [],
        materialKind: "generic",
        containerKind: "pawn",
        containerEntityId: "pawn-1",
        pickupAllowed: true,
        stackCount: 9
      } as WorldEntitySnapshot
    ];

    const items = collectRenderableResourceItems(entities);

    expect(items.map((item) => item.id)).toEqual(["resource-ground", "resource-zone"]);
    expect(items.find((item) => item.id === "resource-zone")?.stackBadgeText).toBe("×4");
    expect(items.find((item) => item.id === "resource-ground")?.stackBadgeText).toBeUndefined();
  });
});
