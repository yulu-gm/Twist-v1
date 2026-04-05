import { describe, expect, it } from "vitest";
import type { EntityId } from "../../src/game/entity";
import { createEntityRegistry, EntityRegistry } from "../../src/game/entity";

function bedBuildingDraft(cell: { col: number; row: number }) {
  return {
    kind: "building" as const,
    buildingKind: "bed" as const,
    cell,
    coveredCells: [cell],
    interactionCapabilities: ["rest"] as const
  };
}

describe("EntityRegistry", () => {
  it("create assigns monotonic ids and get returns the registered entity", () => {
    const reg: EntityRegistry = createEntityRegistry();
    const a = reg.create({
      kind: "tree",
      cell: { col: 1, row: 2 },
      loggingMarked: false,
      occupied: false
    });
    const b = reg.create({
      kind: "resource",
      materialKind: "wood",
      cell: { col: 3, row: 4 },
      containerKind: "ground",
      pickupAllowed: true
    });
    expect(a.id).toBe("entity-1" as EntityId);
    expect(b.id).toBe("entity-2" as EntityId);
    expect(reg.get(a.id)).toBe(a);
    expect(reg.get(b.id)?.kind).toBe("resource");
    expect(reg.get("entity-999" as EntityId)).toBeUndefined();
  });

  it("remove deletes the entity and get returns undefined", () => {
    const reg = createEntityRegistry();
    const e = reg.create(
      bedBuildingDraft({
        col: 0,
        row: 0
      })
    );
    reg.remove(e.id);
    expect(reg.get(e.id)).toBeUndefined();
    expect(reg.getAll()).toHaveLength(0);
  });

  it("getByKind returns only entities of that kind", () => {
    const reg = createEntityRegistry();
    reg.create({
      kind: "pawn",
      cell: { col: 0, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 50,
      energy: 50
    });
    reg.create({
      kind: "pawn",
      cell: { col: 1, row: 0 },
      behavior: undefined,
      currentGoal: undefined,
      satiety: 60,
      energy: 40
    });
    reg.create({
      kind: "tree",
      cell: { col: 2, row: 0 },
      loggingMarked: true,
      occupied: false
    });
    const pawns = reg.getByKind("pawn");
    expect(pawns).toHaveLength(2);
    expect(pawns.every((p) => p.kind === "pawn")).toBe(true);
    expect(reg.getByKind("tree")).toHaveLength(1);
  });

  it("getByCell matches single-cell entities and coveredCells for zones and buildings", () => {
    const reg = createEntityRegistry();
    const cell = { col: 5, row: 5 };
    const other = { col: 5, row: 6 };
    reg.create({
      kind: "resource",
      materialKind: "food",
      cell,
      containerKind: "ground",
      pickupAllowed: true
    });
    reg.create({
      kind: "building",
      buildingKind: "bed",
      cell: { col: 4, row: 5 },
      coveredCells: [
        { col: 4, row: 5 },
        { col: 5, row: 5 }
      ],
      interactionCapabilities: ["rest"]
    });
    reg.create({
      kind: "zone",
      zoneKind: "storage",
      name: "s",
      coveredCells: [other, { col: 7, row: 7 }],
      acceptedMaterialKinds: []
    });
    const atCell = reg.getByCell(cell);
    expect(atCell.some((e) => e.kind === "resource")).toBe(true);
    expect(atCell.some((e) => e.kind === "building")).toBe(true);
    expect(atCell.some((e) => e.kind === "zone")).toBe(false);

    const zoneHits = reg.getByCell(other);
    expect(zoneHits.some((e) => e.kind === "zone")).toBe(true);
  });

  it("getAll lists every registered entity", () => {
    const reg = createEntityRegistry();
    reg.create({
      kind: "tree",
      cell: { col: 0, row: 0 },
      loggingMarked: false,
      occupied: false
    });
    reg.create({
      kind: "tree",
      cell: { col: 1, row: 1 },
      loggingMarked: false,
      occupied: false
    });
    expect(reg.getAll()).toHaveLength(2);
  });

  it("snapshot returns readonly projections that do not alias nested coords", () => {
    const reg = createEntityRegistry();
    const cell = { col: 2, row: 3 };
    const created = reg.create({
      kind: "blueprint",
      blueprintKind: "bed",
      cell,
      coveredCells: [cell, { col: 3, row: 3 }],
      buildProgress01: 0,
      buildState: "planned",
      relatedWorkItemIds: ["w1"]
    });
    const snaps = reg.snapshot();
    expect(snaps).toHaveLength(1);
    const s = snaps[0]!;
    expect(s.kind).toBe("blueprint");
    expect(created.kind).toBe("blueprint");
    if (s.kind !== "blueprint" || created.kind !== "blueprint") throw new Error("expected blueprint");
    expect(s.cell).not.toBe(created.cell);
    expect(s.coveredCells).not.toBe(created.coveredCells);
    expect(s.coveredCells[0]).not.toBe(created.coveredCells[0]);
  });
});
