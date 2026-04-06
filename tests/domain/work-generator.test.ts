import { describe, expect, it } from "vitest";
import {
  generateChopWork,
  generateConstructWork,
  generateHaulWork,
  generatePickUpWork
} from "../../src/game/work";

describe("work-generator", () => {
  describe("generateChopWork", () => {
    it("produces open chop order targeting the tree entity at given cell", () => {
      const w = generateChopWork("tree-42", { col: 3, row: 7 });
      expect(w.kind).toBe("chop");
      expect(w.status).toBe("open");
      expect(w.targetEntityId).toBe("tree-42");
      expect(w.targetCell).toEqual({ col: 3, row: 7 });
      expect(w.priority).toBeGreaterThan(0);
      expect(w.claimedByPawnId).toBeUndefined();
    });

    it("workId encodes entity and cell for uniqueness", () => {
      const a = generateChopWork("t1", { col: 1, row: 2 });
      const b = generateChopWork("t2", { col: 1, row: 2 });
      const c = generateChopWork("t1", { col: 3, row: 4 });
      expect(a.workId).not.toBe(b.workId);
      expect(a.workId).not.toBe(c.workId);
    });

    it("contains navigate + chop steps", () => {
      const w = generateChopWork("t1", { col: 0, row: 0 });
      expect(w.steps.length).toBeGreaterThanOrEqual(2);
      expect(w.steps.some((s) => s.stepType === "navigate-to-target")).toBe(true);
      expect(w.steps.some((s) => s.stepType === "chop-tree")).toBe(true);
    });
  });

  describe("generatePickUpWork", () => {
    it("produces open pick-up order targeting the resource entity", () => {
      const w = generatePickUpWork("res-5", { col: 10, row: 2 });
      expect(w.kind).toBe("pick-up");
      expect(w.status).toBe("open");
      expect(w.targetEntityId).toBe("res-5");
      expect(w.targetCell).toEqual({ col: 10, row: 2 });
    });

    it("has lower priority than chop", () => {
      const chop = generateChopWork("t1", { col: 0, row: 0 });
      const pickup = generatePickUpWork("r1", { col: 0, row: 0 });
      expect(chop.priority).toBeGreaterThan(pickup.priority);
    });
  });

  describe("generateHaulWork", () => {
    it("produces open haul order with haulDropCell and zone reference", () => {
      const w = generateHaulWork("res-1", { col: 1, row: 1 }, "zone-a", { col: 5, row: 5 });
      expect(w.kind).toBe("haul");
      expect(w.status).toBe("open");
      expect(w.targetEntityId).toBe("res-1");
      expect(w.haulDropCell).toEqual({ col: 5, row: 5 });
    });

    it("contains multi-step navigate→pickup→navigate→deposit sequence", () => {
      const w = generateHaulWork("r1", { col: 0, row: 0 }, "z1", { col: 3, row: 3 });
      expect(w.steps.length).toBeGreaterThanOrEqual(4);
      const stepTypes = w.steps.map((s) => s.stepType);
      expect(stepTypes).toContain("navigate-to-resource");
      expect(stepTypes).toContain("deposit-in-zone");
    });

    it("has lower priority than pick-up", () => {
      const pickup = generatePickUpWork("r1", { col: 0, row: 0 });
      const haul = generateHaulWork("r1", { col: 0, row: 0 }, "z1", { col: 1, row: 1 });
      expect(pickup.priority).toBeGreaterThan(haul.priority);
    });
  });

  describe("generateConstructWork", () => {
    it("produces open construct order targeting the blueprint entity", () => {
      const w = generateConstructWork("bp-1", { col: 6, row: 8 });
      expect(w.kind).toBe("construct");
      expect(w.status).toBe("open");
      expect(w.targetEntityId).toBe("bp-1");
      expect(w.targetCell).toEqual({ col: 6, row: 8 });
    });

    it("contains navigate + construct steps", () => {
      const w = generateConstructWork("bp-1", { col: 0, row: 0 });
      expect(w.steps.some((s) => s.stepType === "navigate-to-target")).toBe(true);
      expect(w.steps.some((s) => s.stepType === "construct-blueprint")).toBe(true);
    });
  });

  describe("priority ordering", () => {
    it("chop > construct > pick-up > haul", () => {
      const chop = generateChopWork("t", { col: 0, row: 0 });
      const construct = generateConstructWork("bp", { col: 0, row: 0 });
      const pickup = generatePickUpWork("r", { col: 0, row: 0 });
      const haul = generateHaulWork("r", { col: 0, row: 0 }, "z", { col: 1, row: 1 });
      expect(chop.priority).toBeGreaterThan(construct.priority);
      expect(construct.priority).toBeGreaterThan(pickup.priority);
      expect(pickup.priority).toBeGreaterThan(haul.priority);
    });
  });
});
