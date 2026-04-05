import { describe, expect, it } from "vitest";
import type { EntityId, PawnEntity } from "../../src/game/entity";
import {
  createEntityRegistry,
  dropResource,
  pickUpResource,
  transformBlueprintToBuilding,
  transformTreeToResource
} from "../../src/game/entity";

describe("lifecycle-rules", () => {
  describe("transformTreeToResource", () => {
    it("removes tree and creates wood resource at the same cell", () => {
      const reg = createEntityRegistry();
      const tree = reg.create({
        kind: "tree",
        cell: { col: 2, row: 3 },
        loggingMarked: true,
        occupied: false
      });
      const beforeIds = new Set(reg.getAll().map((e) => e.id));
      const out = transformTreeToResource(reg, tree.id);
      expect(out.kind).toBe("ok");
      if (out.kind !== "ok") return;
      expect(reg.get(tree.id)).toBeUndefined();
      const wood = reg.get(out.resourceId);
      expect(wood?.kind).toBe("resource");
      if (!wood || wood.kind !== "resource") return;
      expect(wood.materialKind).toBe("wood");
      expect(wood.cell).toEqual({ col: 2, row: 3 });
      expect(wood.containerKind).toBe("ground");
      expect(beforeIds.has(tree.id)).toBe(true);
      expect(beforeIds.has(out.resourceId)).toBe(false);
    });

    it("returns wrong-entity-kind when id is not a tree", () => {
      const reg = createEntityRegistry();
      const pawn = reg.create({
        kind: "pawn",
        cell: { col: 0, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });
      const out = transformTreeToResource(reg, pawn.id);
      expect(out).toEqual({
        kind: "wrong-entity-kind",
        entityId: pawn.id,
        expected: "tree",
        actual: "pawn"
      });
      expect(reg.getAll()).toHaveLength(1);
    });
  });

  describe("transformBlueprintToBuilding", () => {
    it("removes blueprint and creates building with matching footprint and kind", () => {
      const reg = createEntityRegistry();
      const cell = { col: 1, row: 1 };
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
      if (out.kind !== "ok") return;
      expect(reg.get(bp.id)).toBeUndefined();
      const b = reg.get(out.buildingId);
      expect(b?.kind).toBe("building");
      if (!b || b.kind !== "building") return;
      expect(b.buildingKind).toBe("bed");
      expect(b.coveredCells).toEqual([cell]);
      expect(b.interactionCapabilities).toEqual(["rest"]);
    });

    it("returns footprint-conflict when a pawn occupies the blueprint footprint", () => {
      const reg = createEntityRegistry();
      const cell = { col: 5, row: 5 };
      const bp = reg.create({
        kind: "blueprint",
        blueprintKind: "bed",
        cell,
        coveredCells: [cell],
        buildProgress01: 1,
        buildState: "completed",
        relatedWorkItemIds: []
      });
      reg.create({
        kind: "pawn",
        cell,
        behavior: undefined,
        currentGoal: undefined,
        satiety: 80,
        energy: 80
      });
      const out = transformBlueprintToBuilding(reg, bp.id);
      expect(out.kind).toBe("footprint-conflict");
      expect(reg.get(bp.id)?.kind).toBe("blueprint");
    });
  });

  describe("pickUpResource", () => {
    it("moves ground resource into pawn container and sets carriedResourceId", () => {
      const reg = createEntityRegistry();
      const cell = { col: 10, row: 10 };
      const pawn = reg.create({
        kind: "pawn",
        cell,
        behavior: undefined,
        currentGoal: undefined,
        satiety: 100,
        energy: 100
      });
      const res = reg.create({
        kind: "resource",
        materialKind: "food",
        cell: { col: 11, row: 10 },
        containerKind: "ground",
        pickupAllowed: true
      });
      const out = pickUpResource(reg, pawn.id, res.id);
      expect(out.kind).toBe("ok");
      const p = reg.get(pawn.id);
      const r = reg.get(res.id);
      expect(p?.kind).toBe("pawn");
      if (p?.kind === "pawn") {
        expect(p.carriedResourceId).toBe(res.id);
      }
      if (r?.kind !== "resource") return;
      expect(r.containerKind).toBe("pawn");
      expect(r.containerEntityId).toBe(pawn.id);
      expect(r.cell).toEqual(cell);
    });

    it("returns pawn-already-carrying when pawn holds another resource", () => {
      const reg = createEntityRegistry();
      const pawn = reg.create({
        kind: "pawn",
        cell: { col: 0, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50,
        carriedResourceId: "entity-99" as EntityId
      });
      const res = reg.create({
        kind: "resource",
        materialKind: "wood",
        cell: { col: 1, row: 0 },
        containerKind: "ground",
        pickupAllowed: true
      });
      const out = pickUpResource(reg, pawn.id, res.id);
      expect(out).toEqual({ kind: "pawn-already-carrying", carriedResourceId: "entity-99" as EntityId });
      expect((reg.get(res.id) as { containerKind: string }).containerKind).toBe("ground");
    });
  });

  describe("dropResource", () => {
    it("places carried resource on target cell and clears pawn carry", () => {
      const reg = createEntityRegistry();
      const pawnCell = { col: 3, row: 4 };
      const targetCell = { col: 3, row: 5 };
      const pawn = reg.create({
        kind: "pawn",
        cell: pawnCell,
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });
      const res = reg.create({
        kind: "resource",
        materialKind: "generic",
        cell: pawnCell,
        containerKind: "pawn",
        containerEntityId: pawn.id,
        pickupAllowed: true
      });
      const carryingPawn: PawnEntity = { ...(pawn as PawnEntity), carriedResourceId: res.id };
      reg.replace(carryingPawn);

      const out = dropResource(reg, pawn.id, targetCell);
      expect(out.kind).toBe("ok");
      const p = reg.get(pawn.id);
      const r = reg.get(res.id);
      expect(p?.kind).toBe("pawn");
      if (p?.kind === "pawn") {
        expect(p.carriedResourceId).toBeUndefined();
      }
      if (r?.kind !== "resource") return;
      expect(r.cell).toEqual(targetCell);
      expect(r.containerKind).toBe("ground");
      expect(r.containerEntityId).toBeUndefined();
    });

    it("returns pawn-not-carrying when pawn has no carriedResourceId", () => {
      const reg = createEntityRegistry();
      const pawn = reg.create({
        kind: "pawn",
        cell: { col: 0, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });
      const out = dropResource(reg, pawn.id, { col: 1, row: 1 });
      expect(out).toEqual({ kind: "pawn-not-carrying" });
    });
  });
});
