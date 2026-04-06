import { describe, expect, it } from "vitest";
import type { WorldEntitySnapshot } from "../../../src/game/entity/entity-types";
import { collectStorageZoneLabelGroups } from "../../../src/scenes/renderers/zone-overlay-renderer";

describe("collectStorageZoneLabelGroups", () => {
  it("splits disjoint storage cells into separate connected groups with the storage label", () => {
    const entities = [
      {
        id: "zone-1",
        kind: "zone",
        cell: { col: 2, row: 2 },
        occupiedCells: [{ col: 2, row: 2 }],
        relatedWorkItemIds: [],
        zoneKind: "storage",
        coveredCells: [
          { col: 2, row: 2 },
          { col: 3, row: 2 },
          { col: 10, row: 10 },
          { col: 10, row: 11 }
        ],
        acceptedMaterialKinds: []
      } as WorldEntitySnapshot
    ];

    const groups = collectStorageZoneLabelGroups(entities);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.anchor)).toEqual([
      { col: 2, row: 2 },
      { col: 10, row: 10 }
    ]);
    expect(groups.every((group) => group.text === "存储区")).toBe(true);
  });
});
