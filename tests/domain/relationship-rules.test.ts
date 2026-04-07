/**
 * 关系与一致性规则单元护栏（validate*、assign* 等）。
 * ENTITY-002/004 的携带与冲突验收以 headless 场景断言为准，本文件仅作底层回归。
 */
import { describe, expect, it } from "vitest";
import type { PawnEntity, ResourceEntity } from "../../src/game/entity";
import {
  assignBedToPawn,
  createEntityRegistry,
  pickUpResource,
  transformBlueprintToBuilding,
  unassignBed,
  validateBedOwnership,
  validateCarrying,
  validateResourceLocation
} from "../../src/game/entity";

function makeBed(reg: ReturnType<typeof createEntityRegistry>, cell: { col: number; row: number }) {
  const bp = reg.create({
    kind: "blueprint",
    blueprintKind: "bed",
    cell,
    coveredCells: [cell],
    buildProgress01: 1,
    buildState: "completed",
    relatedWorkItemIds: []
  });
  const out = transformBlueprintToBuilding(reg, bp.id);
  expect(out.kind).toBe("ok");
  if (out.kind !== "ok") throw new Error("expected bed building");
  return reg.get(out.buildingId)!;
}

describe("relationship-rules", () => {
  describe("validateBedOwnership / assignBedToPawn / unassignBed", () => {
    it("assigns bed to pawn with bidirectional consistency", () => {
      const reg = createEntityRegistry();
      const cell = { col: 0, row: 0 };
      const bedEntity = makeBed(reg, cell);
      if (bedEntity.kind !== "building") throw new Error("expected building");
      const pawn = reg.create({
        kind: "pawn",
        cell: { col: 1, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });

      expect(assignBedToPawn(reg, bedEntity.id, pawn.id)).toEqual({ kind: "ok" });

      const b = reg.get(bedEntity.id);
      expect(b?.kind).toBe("building");
      if (!b || b.kind !== "building") return;
      expect(b.ownership?.ownerPawnId).toBe(pawn.id);

      const p = reg.get(pawn.id);
      expect(p?.kind).toBe("pawn");
      if (!p || p.kind !== "pawn") return;
      expect(p.bedBuildingId).toBe(bedEntity.id);

      const v = validateBedOwnership(reg);
      expect(v.ok).toBe(true);
      expect(v.violations).toHaveLength(0);
    });

    it("reassigning pawn moves ownership from old bed to new bed", () => {
      const reg = createEntityRegistry();
      const bedA = makeBed(reg, { col: 0, row: 0 });
      const bedB = makeBed(reg, { col: 2, row: 0 });
      if (bedA.kind !== "building" || bedB.kind !== "building") throw new Error("expected buildings");

      const pawn = reg.create({
        kind: "pawn",
        cell: { col: 1, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });

      expect(assignBedToPawn(reg, bedA.id, pawn.id)).toEqual({ kind: "ok" });
      expect(assignBedToPawn(reg, bedB.id, pawn.id)).toEqual({ kind: "ok" });

      const a = reg.get(bedA.id);
      const b = reg.get(bedB.id);
      expect(a?.kind).toBe("building");
      expect(b?.kind).toBe("building");
      if (!a || a.kind !== "building" || !b || b.kind !== "building") return;
      expect(a.ownership?.ownerPawnId).toBeUndefined();
      expect(b.ownership?.ownerPawnId).toBe(pawn.id);

      const p = reg.get(pawn.id);
      expect(p?.kind).toBe("pawn");
      if (!p || p.kind !== "pawn") return;
      expect(p.bedBuildingId).toBe(bedB.id);

      expect(validateBedOwnership(reg).ok).toBe(true);
    });

    it("assigning bed to a second pawn clears the previous owner", () => {
      const reg = createEntityRegistry();
      const bed = makeBed(reg, { col: 0, row: 0 });
      if (bed.kind !== "building") throw new Error("expected building");

      const pawn1 = reg.create({
        kind: "pawn",
        cell: { col: 1, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });
      const pawn2 = reg.create({
        kind: "pawn",
        cell: { col: 2, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });

      expect(assignBedToPawn(reg, bed.id, pawn1.id)).toEqual({ kind: "ok" });
      expect(assignBedToPawn(reg, bed.id, pawn2.id)).toEqual({ kind: "ok" });

      const p1 = reg.get(pawn1.id);
      const p2 = reg.get(pawn2.id);
      expect(p1?.kind).toBe("pawn");
      expect(p2?.kind).toBe("pawn");
      if (!p1 || p1.kind !== "pawn" || !p2 || p2.kind !== "pawn") return;
      expect(p1.bedBuildingId).toBeUndefined();
      expect(p2.bedBuildingId).toBe(bed.id);

      const bd = reg.get(bed.id);
      expect(bd?.kind).toBe("building");
      if (!bd || bd.kind !== "building") return;
      expect(bd.ownership?.ownerPawnId).toBe(pawn2.id);

      expect(validateBedOwnership(reg).ok).toBe(true);
    });

    it("unassignBed clears ownership on both sides", () => {
      const reg = createEntityRegistry();
      const bed = makeBed(reg, { col: 0, row: 0 });
      if (bed.kind !== "building") throw new Error("expected building");
      const pawn = reg.create({
        kind: "pawn",
        cell: { col: 1, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });
      expect(assignBedToPawn(reg, bed.id, pawn.id)).toEqual({ kind: "ok" });
      expect(unassignBed(reg, bed.id)).toEqual({ kind: "ok" });

      const bd = reg.get(bed.id);
      const p = reg.get(pawn.id);
      expect(bd?.kind).toBe("building");
      if (!bd || bd.kind !== "building") return;
      expect(bd.ownership?.ownerPawnId).toBeUndefined();
      expect(p?.kind).toBe("pawn");
      if (!p || p.kind !== "pawn") return;
      expect(p.bedBuildingId).toBeUndefined();
      expect(validateBedOwnership(reg).ok).toBe(true);
    });

    it("validateBedOwnership reports mismatch when only one side is set", () => {
      const reg = createEntityRegistry();
      const bed = makeBed(reg, { col: 0, row: 0 });
      if (bed.kind !== "building") throw new Error("expected building");
      const pawn = reg.create({
        kind: "pawn",
        cell: { col: 1, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50,
        bedBuildingId: bed.id
      });

      const v = validateBedOwnership(reg);
      expect(v.ok).toBe(false);
      expect(v.violations.some((x) => x.kind === "pawn-bed-ownership-mismatch")).toBe(true);
    });
  });

  describe("validateResourceLocation", () => {
    it("flags ground resource with containerEntityId", () => {
      const reg = createEntityRegistry();
      const res = reg.create({
        kind: "resource",
        materialKind: "wood",
        cell: { col: 0, row: 0 },
        containerKind: "ground",
        pickupAllowed: true
      });
      reg.replace({
        ...res,
        containerEntityId: "entity-999" as import("../../src/game/entity").EntityId
      });
      const v = validateResourceLocation(reg);
      expect(v.ok).toBe(false);
      expect(v.violations[0]?.kind).toBe("resource-ground-has-container-entity");
    });
  });

  describe("validateCarrying", () => {
    it("passes after pickUpResource", () => {
      const reg = createEntityRegistry();
      const pawn = reg.create({
        kind: "pawn",
        cell: { col: 0, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });
      const res = reg.create({
        kind: "resource",
        materialKind: "wood",
        cell: { col: 0, row: 0 },
        containerKind: "ground",
        pickupAllowed: true
      });
      expect(pickUpResource(reg, pawn.id, res.id)).toEqual({ kind: "ok" });
      const v = validateCarrying(reg);
      expect(v.ok).toBe(true);
    });

    it("flags mismatch when containerEntityId does not match pawn", () => {
      const reg = createEntityRegistry();
      const pawn = reg.create({
        kind: "pawn",
        cell: { col: 0, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50,
        carriedResourceId: undefined
      });
      const other = reg.create({
        kind: "pawn",
        cell: { col: 1, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });
      const res = reg.create({
        kind: "resource",
        materialKind: "wood",
        cell: { col: 0, row: 0 },
        containerKind: "pawn",
        containerEntityId: pawn.id,
        pickupAllowed: true
      });
      const pawnSnap = reg.get(pawn.id);
      const resSnap = reg.get(res.id);
      expect(pawnSnap?.kind).toBe("pawn");
      expect(resSnap?.kind).toBe("resource");
      if (!pawnSnap || pawnSnap.kind !== "pawn" || !resSnap || resSnap.kind !== "resource") return;

      const pawnRow = pawnSnap as PawnEntity;
      const resRow = resSnap as ResourceEntity;
      reg.replace({
        ...pawnRow,
        cell: { ...pawnRow.cell },
        carriedResourceId: res.id
      });
      reg.replace({
        ...resRow,
        cell: { ...resRow.cell },
        containerKind: "pawn",
        containerEntityId: other.id
      });

      const v = validateCarrying(reg);
      expect(v.ok).toBe(false);
      expect(v.violations.some((x) => x.kind === "pawn-carried-resource-container-mismatch")).toBe(true);
    });
  });
});
