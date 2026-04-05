import { describe, expect, it } from "vitest";
import {
  addWork,
  createWorkRegistry,
  generateChopWork,
  generateConstructWork,
  generateHaulWork,
  generatePickUpWork,
  getByKind,
  getByStatus,
  getByTarget,
  removeWork
} from "../../src/game/work";
import type { WorkOrder } from "../../src/game/work/work-types";

function withStatus(order: WorkOrder, status: WorkOrder["status"]): WorkOrder {
  return { ...order, status };
}

describe("WorkRegistry", () => {
  it("addWork stores orders and removeWork deletes by workId", () => {
    const registry = createWorkRegistry();
    const a = generateChopWork("entity-tree-1", { col: 1, row: 2 });
    const b = generatePickUpWork("entity-res-1", { col: 3, row: 4 });
    addWork(registry, a);
    addWork(registry, b);
    expect(registry.orders.size).toBe(2);
    removeWork(registry, a.workId);
    expect(registry.orders.size).toBe(1);
    expect(registry.orders.has(a.workId)).toBe(false);
    expect(registry.orders.get(b.workId)?.kind).toBe("pick-up");
  });

  it("getByStatus returns only matching orders", () => {
    const registry = createWorkRegistry();
    const chop = generateChopWork("t1", { col: 0, row: 0 });
    const haul = withStatus(generateHaulWork("r1", { col: 1, row: 1 }, "zone-a", { col: 2, row: 2 }), "claimed");
    addWork(registry, chop);
    addWork(registry, haul);
    const open = getByStatus(registry, "open");
    const claimed = getByStatus(registry, "claimed");
    expect(open).toHaveLength(1);
    expect(open[0].workId).toBe(chop.workId);
    expect(claimed).toHaveLength(1);
    expect(claimed[0].workId).toBe(haul.workId);
    expect(getByStatus(registry, "failed")).toHaveLength(0);
  });

  it("getByKind filters by WorkOrderKind", () => {
    const registry = createWorkRegistry();
    addWork(registry, generateConstructWork("bp-1", { col: 0, row: 0 }));
    addWork(registry, generateConstructWork("bp-2", { col: 2, row: 2 }));
    addWork(registry, generatePickUpWork("res-1", { col: 1, row: 1 }));
    const constructs = getByKind(registry, "construct");
    expect(constructs).toHaveLength(2);
    expect(constructs.every((w) => w.kind === "construct")).toBe(true);
    expect(getByKind(registry, "pick-up")).toHaveLength(1);
  });

  it("getByTarget returns orders for targetEntityId", () => {
    const registry = createWorkRegistry();
    const id = "shared-target";
    addWork(registry, generatePickUpWork(id, { col: 0, row: 0 }));
    addWork(registry, withStatus(generateHaulWork(id, { col: 0, row: 0 }, "z1", { col: 3, row: 3 }), "claimed"));
    const forTarget = getByTarget(registry, id);
    expect(forTarget).toHaveLength(2);
    expect(new Set(forTarget.map((w) => w.kind))).toEqual(new Set(["pick-up", "haul"]));
    expect(getByTarget(registry, "missing")).toHaveLength(0);
  });
});

describe("WorkOrder generators", () => {
  const cell = { col: 5, row: 7 };

  it("generateChopWork produces deterministic workId and consistent fields", () => {
    const eid = "entity-9";
    const w = generateChopWork(eid, cell);
    expect(w.workId).toBe("work:chop:entity-9:5,7");
    expect(w.kind).toBe("chop");
    expect(w.status).toBe("open");
    expect(w.targetEntityId).toBe(eid);
    expect(w.targetCell).toEqual(cell);
    expect(w.steps.length).toBeGreaterThanOrEqual(2);
    expect(w.steps[0].stepType).toBe("navigate-to-target");
    expect(w.steps[1].stepType).toBe("chop-tree");
  });

  it("generatePickUpWork produces deterministic workId", () => {
    const w = generatePickUpWork("res-2", cell);
    expect(w.workId).toBe("work:pick-up:res-2:5,7");
    expect(w.kind).toBe("pick-up");
    expect(w.targetEntityId).toBe("res-2");
    expect(w.steps[w.steps.length - 1].stepType).toBe("pick-up-resource");
  });

  it("generateHaulWork encodes from cell and zone in workId and steps", () => {
    const drop = { col: 9, row: 8 };
    const w = generateHaulWork("res-3", cell, "stockpile-main", drop);
    expect(w.workId).toBe("work:haul:res-3:5,7:stockpile-main");
    expect(w.kind).toBe("haul");
    expect(w.targetCell).toEqual(cell);
    expect(w.haulDropCell).toEqual(drop);
    const zoneSteps = w.steps.filter((s) => s.precondition.includes("stockpile-main"));
    expect(zoneSteps.length).toBeGreaterThanOrEqual(1);
  });

  it("generateConstructWork targets blueprint entity", () => {
    const w = generateConstructWork("bp-99", cell);
    expect(w.workId).toBe("work:construct:bp-99:5,7");
    expect(w.kind).toBe("construct");
    expect(w.targetEntityId).toBe("bp-99");
    expect(w.steps.some((s) => s.stepType === "construct-blueprint")).toBe(true);
  });

  it("same inputs yield same workId (stable for tests)", () => {
    expect(generateChopWork("t", cell).workId).toBe(generateChopWork("t", cell).workId);
  });
});
