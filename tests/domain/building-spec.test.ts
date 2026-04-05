import { describe, expect, it } from "vitest";
import {
  BUILDING_SPECS,
  cancelBlueprint,
  createBlueprint,
  getBuildingSpec,
  isBlueprintComplete,
  updateBlueprintProgress
} from "../../src/game/building";
import { createEntityRegistry } from "../../src/game/entity/entity-registry";

describe("building-spec-catalog", () => {
  it("getBuildingSpec returns wall and bed specs from BUILDING_SPECS", () => {
    const wall = getBuildingSpec("wall");
    expect(wall).toBe(BUILDING_SPECS.wall);
    expect(wall?.buildingKind).toBe("wall");
    expect(wall?.blocksMovement).toBe(true);
    expect(wall?.interactionCapabilities).toEqual([]);

    const bed = getBuildingSpec("bed");
    expect(bed).toBe(BUILDING_SPECS.bed);
    expect(bed?.buildingKind).toBe("bed");
    expect(bed?.interactionCapabilities).toEqual(["rest"]);
    expect(bed?.onCompleteRules).toContain("assign-bed-ownership");
  });

  it("getBuildingSpec returns undefined for unknown type", () => {
    expect(getBuildingSpec("unknown-kind")).toBeUndefined();
  });
});

describe("blueprint-manager", () => {
  it("createBlueprint registers entity with spec-aligned fields", () => {
    const reg = createEntityRegistry();
    const spec = getBuildingSpec("bed")!;
    const bp = createBlueprint(reg, spec, { anchor: { col: 5, row: 4 } });
    expect(bp.id).toMatch(/^entity-/);
    expect(bp.blueprintKind).toBe("bed");
    expect(bp.cell).toEqual({ col: 5, row: 4 });
    expect(bp.coveredCells).toEqual([{ col: 5, row: 4 }]);
    expect(bp.buildProgress01).toBe(0);
    expect(bp.buildState).toBe("planned");
    expect(bp.relatedWorkItemIds).toEqual([]);
    expect(reg.get(bp.id)).toEqual(bp);
  });

  it("updateBlueprintProgress clamps and sets completed state at 1", () => {
    const reg = createEntityRegistry();
    const spec = getBuildingSpec("wall")!;
    const bp = createBlueprint(reg, spec, { anchor: { col: 1, row: 1 } });
    updateBlueprintProgress(reg, bp.id, 0.4);
    let cur = reg.get(bp.id);
    expect(cur?.kind).toBe("blueprint");
    if (cur?.kind !== "blueprint") throw new Error("expected blueprint");
    expect(cur.buildProgress01).toBe(0.4);
    expect(cur.buildState).toBe("in-progress");

    updateBlueprintProgress(reg, bp.id, 0.8);
    cur = reg.get(bp.id);
    if (cur?.kind !== "blueprint") throw new Error("expected blueprint");
    expect(cur.buildProgress01).toBe(1);
    expect(cur.buildState).toBe("completed");
  });

  it("updateBlueprintProgress clamps to 0..1", () => {
    const reg = createEntityRegistry();
    const spec = getBuildingSpec("bed")!;
    const bp = createBlueprint(reg, spec, { anchor: { col: 0, row: 0 } });
    updateBlueprintProgress(reg, bp.id, -0.5);
    let cur = reg.get(bp.id);
    if (cur?.kind !== "blueprint") throw new Error("expected blueprint");
    expect(cur.buildProgress01).toBe(0);
    expect(cur.buildState).toBe("planned");

    updateBlueprintProgress(reg, bp.id, 2);
    cur = reg.get(bp.id);
    if (cur?.kind !== "blueprint") throw new Error("expected blueprint");
    expect(cur.buildProgress01).toBe(1);
    expect(cur.buildState).toBe("completed");
  });

  it("isBlueprintComplete follows buildState and progress", () => {
    const reg = createEntityRegistry();
    const spec = getBuildingSpec("wall")!;
    const bp = createBlueprint(reg, spec, { anchor: { col: 2, row: 2 } });
    expect(isBlueprintComplete(reg, bp.id)).toBe(false);
    updateBlueprintProgress(reg, bp.id, 1);
    expect(isBlueprintComplete(reg, bp.id)).toBe(true);
  });

  it("cancelBlueprint removes blueprint entity", () => {
    const reg = createEntityRegistry();
    const spec = getBuildingSpec("bed")!;
    const bp = createBlueprint(reg, spec, { anchor: { col: 3, row: 3 } });
    cancelBlueprint(reg, bp.id);
    expect(reg.get(bp.id)).toBeUndefined();
  });
});
