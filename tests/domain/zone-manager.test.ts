import { describe, expect, it } from "vitest";
import type { EntityId } from "../../src/game/entity";
import { createEntityRegistry } from "../../src/game/entity";
import {
  axisAlignedBoundsFromCoveredCells,
  connectedComponentCountFromCoveredCells,
  createOccupancyMap,
  createZone,
  getZoneAtCell,
  getZonesByType,
  occupy,
  removeZone,
  validateZoneCells
} from "../../src/game/map";

describe("zone-manager", () => {
  it("createZone registers a ZoneEntity with expected fields", () => {
    const registry = createEntityRegistry();
    const z = createZone(
      registry,
      [
        { col: 0, row: 0 },
        { col: 1, row: 0 }
      ],
      createOccupancyMap(),
      "storage",
      "木材区",
      ["wood", "generic"]
    );

    expect(z.kind).toBe("zone");
    expect(z.zoneKind).toBe("storage");
    expect(z.name).toBe("木材区");
    expect(z.acceptedMaterialKinds).toEqual(["wood", "generic"]);
    expect(z.coveredCells).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 }
    ]);
    expect(z.id).toBe("entity-1" as EntityId);
    expect(registry.get(z.id)).toBe(z);
  });

  it("createZone deduplicates cells by coord and keeps first-seen order", () => {
    const registry = createEntityRegistry();
    const z = createZone(
      registry,
      [
        { col: 2, row: 3 },
        { col: 2, row: 3 },
        { col: 3, row: 3 }
      ],
      createOccupancyMap(),
      "custom",
      "dedup",
      []
    );
    expect(z.coveredCells).toEqual([
      { col: 2, row: 3 },
      { col: 3, row: 3 }
    ]);
  });

  it("createZone throws when input is empty after deduplication", () => {
    const registry = createEntityRegistry();
    expect(() => createZone(registry, [], createOccupancyMap(), "storage", "x", [])).toThrow(/non-empty/);
  });

  it("createZone throws when a covered cell is occupied", () => {
    const registry = createEntityRegistry();
    const map = createOccupancyMap();
    occupy(map, { col: 0, row: 0 }, "entity-blocker");
    expect(() => createZone(registry, [{ col: 0, row: 0 }], map, "storage", "z", [])).toThrow(/occupied/);
  });

  it("getZoneAtCell returns the zone covering the cell", () => {
    const registry = createEntityRegistry();
    const z = createZone(registry, [{ col: 5, row: 5 }], createOccupancyMap(), "forbidden", "f", []);
    expect(getZoneAtCell(registry, { col: 5, row: 5 })).toBe(z);
    expect(getZoneAtCell(registry, { col: 0, row: 0 })).toBeUndefined();
  });

  it("getZoneAtCell picks lexicographically smallest id when multiple zones overlap", () => {
    const registry = createEntityRegistry();
    createZone(registry, [{ col: 1, row: 1 }], createOccupancyMap(), "storage", "first", []);
    const later = createZone(
      registry,
      [
        { col: 1, row: 1 },
        { col: 2, row: 2 }
      ],
      createOccupancyMap(),
      "custom",
      "second",
      []
    );
    const at = getZoneAtCell(registry, { col: 1, row: 1 });
    expect(at?.id).toBe("entity-1" as EntityId);
    expect(at?.name).toBe("first");
    expect(getZoneAtCell(registry, { col: 2, row: 2 })?.id).toBe(later.id);
  });

  it("getZonesByType returns only matching zoneKind", () => {
    const registry = createEntityRegistry();
    createZone(registry, [{ col: 0, row: 0 }], createOccupancyMap(), "storage", "a", []);
    const b = createZone(registry, [{ col: 1, row: 0 }], createOccupancyMap(), "priority-build", "b", []);
    createZone(registry, [{ col: 2, row: 0 }], createOccupancyMap(), "storage", "c", []);
    const storage = getZonesByType(registry, "storage");
    expect(storage).toHaveLength(2);
    expect(storage.every((z) => z.zoneKind === "storage")).toBe(true);
    expect(getZonesByType(registry, "priority-build").map((z) => z.id)).toEqual([b.id]);
  });

  it("removeZone removes only zone entities", () => {
    const registry = createEntityRegistry();
    const z = createZone(registry, [{ col: 0, row: 0 }], createOccupancyMap(), "storage", "z", []);
    const pawn = registry.create({
      kind: "pawn",
      cell: { col: 3, row: 3 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 50,
      energy: 50
    });

    removeZone(registry, pawn.id);
    expect(registry.get(pawn.id)).toBe(pawn);

    removeZone(registry, z.id);
    expect(registry.get(z.id)).toBeUndefined();
  });

  it("validateZoneCells fails on empty cells", () => {
    const map = createOccupancyMap();
    expect(validateZoneCells([], map)).toEqual({ ok: false, reason: "empty" });
  });

  it("validateZoneCells fails on duplicate coordinates", () => {
    const map = createOccupancyMap();
    const r = validateZoneCells(
      [
        { col: 0, row: 0 },
        { col: 0, row: 0 }
      ],
      map
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("duplicate_cell");
      expect(r.cell).toEqual({ col: 0, row: 0 });
    }
  });

  it("validateZoneCells fails when any cell is occupied", () => {
    const map = createOccupancyMap();
    occupy(map, { col: 1, row: 1 }, "entity-9");
    const r = validateZoneCells(
      [
        { col: 1, row: 1 },
        { col: 2, row: 2 }
      ],
      map
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("cell_occupied");
      expect(r.cell).toEqual({ col: 1, row: 1 });
      expect(r.occupantId).toBe("entity-9");
    }
  });

  it("validateZoneCells succeeds when cells are non-empty, unique, and unoccupied", () => {
    const map = createOccupancyMap();
    occupy(map, { col: 9, row: 9 }, "other");
    expect(
      validateZoneCells(
        [
          { col: 0, row: 0 },
          { col: 1, row: 0 }
        ],
        map
      )
    ).toEqual({ ok: true });
  });

  it("axisAlignedBoundsFromCoveredCells returns undefined for empty and min/max for non-empty", () => {
    expect(axisAlignedBoundsFromCoveredCells([])).toBeUndefined();
    expect(
      axisAlignedBoundsFromCoveredCells([
        { col: 2, row: 1 },
        { col: 0, row: 3 },
        { col: 2, row: 3 }
      ])
    ).toEqual({ minCol: 0, maxCol: 2, minRow: 1, maxRow: 3 });
  });

  it("connectedComponentCountFromCoveredCells counts 4-neighbor components", () => {
    expect(connectedComponentCountFromCoveredCells([])).toBe(0);
    expect(connectedComponentCountFromCoveredCells([{ col: 0, row: 0 }])).toBe(1);
    expect(
      connectedComponentCountFromCoveredCells([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 5, row: 5 }
      ])
    ).toBe(2);
  });
});
