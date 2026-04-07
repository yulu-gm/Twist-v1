import { describe, expect, it } from "vitest";
import {
  addWork,
  claimWork,
  createWorkRegistry,
  generateChopWork,
  generatePickUpWork,
  getAvailableWork,
  isWorkClaimed,
  releaseWork,
  replaceWorkRegistryOrders
} from "../../src/game/work";
import type { WorkOrder } from "../../src/game/work/work-types";

const cell = { col: 1, row: 1 };

function withPriority(order: WorkOrder, priority: number): WorkOrder {
  return { ...order, priority };
}

describe("work-scheduler", () => {
  it("getAvailableWork returns only open orders sorted by priority desc then workId asc", () => {
    const registry = createWorkRegistry();
    const low = withPriority(generatePickUpWork("r-low", cell), 3);
    const high = withPriority(generateChopWork("t-high", cell), 50);
    const midA = withPriority(generateChopWork("t-mid-a", { col: 2, row: 2 }), 10);
    const midB = withPriority(generateChopWork("t-mid-b", { col: 3, row: 3 }), 10);
    addWork(registry, low);
    addWork(registry, high);
    addWork(registry, midB);
    addWork(registry, midA);
    const avail = getAvailableWork(registry);
    expect(avail.map((w) => w.workId)).toEqual([
      high.workId,
      midA.workId,
      midB.workId,
      low.workId
    ]);
  });

  it("claimWork moves open to claimed and sets claimedByPawnId", () => {
    const registry = createWorkRegistry();
    const w = generateChopWork("tree-1", cell);
    addWork(registry, w);
    const step = claimWork(registry, w.workId, "p1");
    replaceWorkRegistryOrders(registry, step.registry);
    expect(step.outcome).toEqual({ kind: "claimed" });
    const stored = registry.orders.get(w.workId);
    expect(stored?.status).toBe("claimed");
    expect(stored?.claimedByPawnId).toBe("p1");
    expect(isWorkClaimed(registry, w.workId)).toBe(true);
  });

  it("claimWork rejects second pawn with already-claimed", () => {
    const registry = createWorkRegistry();
    const w = generatePickUpWork("res-1", cell);
    addWork(registry, w);
    const a = claimWork(registry, w.workId, "alice");
    replaceWorkRegistryOrders(registry, a.registry);
    expect(a.outcome).toEqual({ kind: "claimed" });
    const b = claimWork(registry, w.workId, "bob");
    replaceWorkRegistryOrders(registry, b.registry);
    expect(b.outcome).toEqual({ kind: "already-claimed", claimedByPawnId: "alice" });
    expect(registry.orders.get(w.workId)?.claimedByPawnId).toBe("alice");
  });

  it("releaseWork by owner returns work to open; wrong pawn is no-op", () => {
    const registry = createWorkRegistry();
    const w = generateChopWork("tree-2", cell);
    addWork(registry, w);
    const c = claimWork(registry, w.workId, "owner");
    replaceWorkRegistryOrders(registry, c.registry);
    const r0 = releaseWork(registry, w.workId, "stranger");
    replaceWorkRegistryOrders(registry, r0.registry);
    expect(registry.orders.get(w.workId)?.status).toBe("claimed");
    expect(registry.orders.get(w.workId)?.claimedByPawnId).toBe("owner");
    const r1 = releaseWork(registry, w.workId, "owner");
    replaceWorkRegistryOrders(registry, r1.registry);
    const after = registry.orders.get(w.workId);
    expect(after?.status).toBe("open");
    expect(after?.claimedByPawnId).toBeUndefined();
    expect(isWorkClaimed(registry, w.workId)).toBe(false);
  });

  it("claimWork returns missing-work for unknown id", () => {
    const registry = createWorkRegistry();
    expect(claimWork(registry, "no-such-work", "p1").outcome).toEqual({ kind: "missing-work" });
  });

  it("claimWork returns not-open for terminal status", () => {
    const registry = createWorkRegistry();
    const w = { ...generateChopWork("tree-3", cell), status: "completed" as const };
    addWork(registry, w);
    expect(claimWork(registry, w.workId, "p1").outcome).toEqual({ kind: "not-open" });
  });
});
