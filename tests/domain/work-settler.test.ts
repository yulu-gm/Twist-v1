import { describe, expect, it } from "vitest";
import { createEntityRegistry, pickUpResource } from "../../src/game/entity";
import {
  addWork,
  claimWork,
  createWorkRegistry,
  generateChopWork,
  generateConstructWork,
  generateHaulWork,
  generatePickUpWork,
  replaceWorkRegistryOrders,
  settleWorkFailure,
  settleWorkSuccess
} from "../../src/game/work";

function claim(registry: ReturnType<typeof createWorkRegistry>, workId: string, pawnId: string): void {
  const step = claimWork(registry, workId, pawnId);
  expect(step.outcome.kind).toBe("claimed");
  replaceWorkRegistryOrders(registry, step.registry);
}

describe("work-settler", () => {
  describe("settleWorkSuccess", () => {
    it("chop: transforms tree, completes work, derives pick-up order", () => {
      const entities = createEntityRegistry();
      const tree = entities.create({
        kind: "tree",
        cell: { col: 2, row: 3 },
        loggingMarked: true,
        occupied: false
      });
      const pawn = entities.create({
        kind: "pawn",
        cell: { col: 0, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });

      const registry = createWorkRegistry();
      const chop = generateChopWork(tree.id, { col: 2, row: 3 });
      addWork(registry, chop);
      claim(registry, chop.workId, pawn.id);

      const beforeSize = registry.orders.size;
      const res = settleWorkSuccess(registry, chop.workId, entities);
      expect(res.kind).toBe("ok");
      if (res.kind !== "ok") return;
      expect(res.derivedPickUpWorkId).toBeDefined();
      const derivedId = res.derivedPickUpWorkId!;

      expect(registry.orders.get(chop.workId)?.status).toBe("completed");
      expect(registry.orders.size).toBe(beforeSize + 1);
      const pickWork = registry.orders.get(derivedId);
      expect(pickWork?.kind).toBe("pick-up");
      expect(pickWork?.status).toBe("open");

      const wood = entities.getAll().find((e) => e.kind === "resource");
      expect(wood?.id).toBe(pickWork?.targetEntityId);
    });

    it("construct: blueprint becomes building and work completes", () => {
      const entities = createEntityRegistry();
      const cell = { col: 1, row: 1 };
      const bp = entities.create({
        kind: "blueprint",
        blueprintKind: "bed",
        cell,
        coveredCells: [cell],
        buildProgress01: 1,
        buildState: "completed",
        relatedWorkItemIds: []
      });
      const pawn = entities.create({
        kind: "pawn",
        cell: { col: 99, row: 99 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });

      const registry = createWorkRegistry();
      const w = generateConstructWork(bp.id, cell);
      addWork(registry, w);
      claim(registry, w.workId, pawn.id);

      const res = settleWorkSuccess(registry, w.workId, entities);
      expect(res.kind).toBe("ok");
      expect(registry.orders.get(w.workId)?.status).toBe("completed");
      expect(entities.get(bp.id)).toBeUndefined();
      const building = entities.getAll().find((e) => e.kind === "building");
      expect(building?.kind).toBe("building");
    });

    it("pick-up: uses claimed pawn to pick resource", () => {
      const entities = createEntityRegistry();
      const cell = { col: 4, row: 4 };
      const pawn = entities.create({
        kind: "pawn",
        cell,
        behavior: undefined,
        currentGoal: undefined,
        satiety: 80,
        energy: 80
      });
      const resource = entities.create({
        kind: "resource",
        materialKind: "wood",
        cell,
        containerKind: "ground",
        pickupAllowed: true
      });

      const registry = createWorkRegistry();
      const w = generatePickUpWork(resource.id, cell);
      addWork(registry, w);
      claim(registry, w.workId, pawn.id);

      const res = settleWorkSuccess(registry, w.workId, entities);
      expect(res.kind).toBe("ok");
      expect(registry.orders.get(w.workId)?.status).toBe("completed");
      const p = entities.get(pawn.id);
      expect(p?.kind).toBe("pawn");
      if (p?.kind !== "pawn") return;
      expect(p.carriedResourceId).toBe(resource.id);
    });

    it("pick-up: fails when claimed but pawn id missing on order", () => {
      const entities = createEntityRegistry();
      const cell = { col: 0, row: 0 };
      const pawn = entities.create({
        kind: "pawn",
        cell,
        behavior: undefined,
        currentGoal: undefined,
        satiety: 80,
        energy: 80
      });
      const resource = entities.create({
        kind: "resource",
        materialKind: "wood",
        cell,
        containerKind: "ground",
        pickupAllowed: true
      });

      const registry = createWorkRegistry();
      const w = generatePickUpWork(resource.id, cell);
      addWork(registry, w);
      claim(registry, w.workId, pawn.id);
      const cur = registry.orders.get(w.workId)!;
      registry.orders.set(w.workId, { ...cur, claimedByPawnId: undefined });

      const res = settleWorkSuccess(registry, w.workId, entities);
      expect(res).toEqual({ kind: "pick-up-missing-pawn" });
    });

    it("haul: drops carried resource at haulDropCell", () => {
      const entities = createEntityRegistry();
      const from = { col: 1, row: 1 };
      const drop = { col: 5, row: 5 };
      const resource = entities.create({
        kind: "resource",
        materialKind: "wood",
        cell: from,
        containerKind: "ground",
        pickupAllowed: true
      });
      const pawn = entities.create({
        kind: "pawn",
        cell: from,
        behavior: undefined,
        currentGoal: undefined,
        satiety: 90,
        energy: 90
      });
      expect(pickUpResource(entities, pawn.id, resource.id).kind).toBe("ok");

      const registry = createWorkRegistry();
      const w = generateHaulWork(resource.id, from, "z1", drop);
      addWork(registry, w);
      claim(registry, w.workId, pawn.id);

      const res = settleWorkSuccess(registry, w.workId, entities);
      expect(res.kind).toBe("ok");
      expect(registry.orders.get(w.workId)?.status).toBe("completed");
      const r = entities.get(resource.id);
      expect(r?.kind).toBe("resource");
      if (r?.kind !== "resource") return;
      expect(r.containerKind).toBe("ground");
      expect(r.cell).toEqual(drop);
    });

    it("haul: fails without haulDropCell", () => {
      const entities = createEntityRegistry();
      const cell = { col: 0, row: 0 };
      const resource = entities.create({
        kind: "resource",
        materialKind: "wood",
        cell,
        containerKind: "ground",
        pickupAllowed: true
      });
      const pawn = entities.create({
        kind: "pawn",
        cell,
        behavior: undefined,
        currentGoal: undefined,
        satiety: 90,
        energy: 90,
        carriedResourceId: resource.id
      });

      const registry = createWorkRegistry();
      const w = generateHaulWork(resource.id, cell, "z1", { col: 1, row: 1 });
      addWork(registry, w);
      claim(registry, w.workId, pawn.id);
      const cur = registry.orders.get(w.workId)!;
      registry.orders.set(w.workId, { ...cur, haulDropCell: undefined });

      const res = settleWorkSuccess(registry, w.workId, entities);
      expect(res).toEqual({ kind: "haul-missing-drop-cell" });
    });

    it("returns work-not-claimed when order is still open", () => {
      const entities = createEntityRegistry();
      const tree = entities.create({
        kind: "tree",
        cell: { col: 0, row: 0 },
        loggingMarked: true,
        occupied: false
      });
      const registry = createWorkRegistry();
      const chop = generateChopWork(tree.id, { col: 0, row: 0 });
      addWork(registry, chop);

      const res = settleWorkSuccess(registry, chop.workId, entities);
      expect(res).toEqual({ kind: "work-not-claimed", status: "open" });
    });

    it("returns tree-transform-failed when target is not a tree", () => {
      const entities = createEntityRegistry();
      const pawn = entities.create({
        kind: "pawn",
        cell: { col: 0, row: 0 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });
      const registry = createWorkRegistry();
      const chop = generateChopWork(pawn.id, { col: 0, row: 0 });
      addWork(registry, chop);
      claim(registry, chop.workId, pawn.id);

      const res = settleWorkSuccess(registry, chop.workId, entities);
      expect(res.kind).toBe("tree-transform-failed");
      if (res.kind !== "tree-transform-failed") return;
      expect(res.outcome.kind).toBe("wrong-entity-kind");
    });
  });

  describe("settleWorkFailure", () => {
    it("reopens claimed work and records lastFailureReason", () => {
      const entities = createEntityRegistry();
      const tree = entities.create({
        kind: "tree",
        cell: { col: 0, row: 0 },
        loggingMarked: true,
        occupied: false
      });
      const pawn = entities.create({
        kind: "pawn",
        cell: { col: 1, row: 1 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });
      const registry = createWorkRegistry();
      const chop = generateChopWork(tree.id, { col: 0, row: 0 });
      addWork(registry, chop);
      claim(registry, chop.workId, pawn.id);

      settleWorkFailure(registry, chop.workId, "path-lost");
      const w = registry.orders.get(chop.workId);
      expect(w?.status).toBe("open");
      expect(w?.claimedByPawnId).toBeUndefined();
      expect(w?.lastFailureReason).toBe("path-lost");
    });

    it("does not revert completed work", () => {
      const entities = createEntityRegistry();
      const cell = { col: 1, row: 1 };
      const bp = entities.create({
        kind: "blueprint",
        blueprintKind: "bed",
        cell,
        coveredCells: [cell],
        buildProgress01: 1,
        buildState: "completed",
        relatedWorkItemIds: []
      });
      const pawn = entities.create({
        kind: "pawn",
        cell: { col: 20, row: 20 },
        behavior: undefined,
        currentGoal: undefined,
        satiety: 50,
        energy: 50
      });
      const registry = createWorkRegistry();
      const w = generateConstructWork(bp.id, cell);
      addWork(registry, w);
      claim(registry, w.workId, pawn.id);
      expect(settleWorkSuccess(registry, w.workId, entities).kind).toBe("ok");

      settleWorkFailure(registry, w.workId, "late-fail");
      expect(registry.orders.get(w.workId)?.status).toBe("completed");
    });
  });
});
