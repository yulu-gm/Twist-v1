import { describe, expect, it } from "vitest";
import { createSeededEntityRegistry, EntityLifecycle } from "../src/game/entity-system";
import { DEFAULT_WORLD_GRID } from "../src/game/world-grid";
import { WorkRegistry } from "../src/game/work-system";
import { findStockpileDepositCell, upsertPendingStockpileDepositWork } from "../src/game/stockpile-deposit";
import { tickSimulation } from "../src/game/sim-loop";
import { DEFAULT_SIM_CONFIG } from "../src/game/sim-config";
import { buildClaimablePendingWorks } from "../src/game/work-claim";
import type { PawnState } from "../src/game/pawn-state";
import { chooseGoalDecision } from "../src/game/goal-driven-planning";

describe("stockpile deposit", () => {
  it("findStockpileDepositCell returns nearest legal cell in stockpile", () => {
    const registry = createSeededEntityRegistry();
    const wr = new WorkRegistry();
    const wood = registry.listMaterialsOnGround().find((m) => m.materialKind === "木柴");
    expect(wood).toBeDefined();
    const slot = findStockpileDepositCell(
      DEFAULT_WORLD_GRID,
      registry,
      wr,
      "pawn-x",
      wood!.cell,
      "木柴"
    );
    expect(slot).toBeDefined();
    expect(slot!.cell.col).toBeGreaterThanOrEqual(18);
  });

  it("pawnDropMaterial with zone id sets storage containerKind", () => {
    const registry = createSeededEntityRegistry();
    const zone = registry.listEntitiesByKind("zone")[0];
    expect(zone).toBeDefined();
    const at = { col: 18, row: 0 };
    registry.registerMaterial({
      kind: "material",
      id: "mat-carry",
      materialKind: "测试料",
      cell: { col: 0, row: 0 },
      containerKind: "pawn",
      containerId: "pawn-0",
      pickupAllowed: true,
      quantity: 3
    });
    registry.updatePawn({
      kind: "pawn",
      id: "pawn-0",
      cell: at,
      behaviorState: "test",
      carriedMaterialId: "mat-carry",
      saturation: 50,
      energy: 50
    });
    EntityLifecycle.pawnDropMaterial(registry, "pawn-0", "mat-carry", at, zone!.id);
    const dropped = registry.getMaterial("mat-carry");
    expect(dropped?.containerKind).toBe("zone");
    expect(dropped?.containerId).toBe(zone!.id);
    expect(registry.getPawn("pawn-0")?.carriedMaterialId).toBeUndefined();
  });

  it("rejects dropping foreign material kind onto existing stack", () => {
    const registry = createSeededEntityRegistry();
    const zone = registry.listEntitiesByKind("zone")[0]!;
    const cell = { col: 18, row: 0 };
    registry.registerMaterial({
      kind: "material",
      id: "mat-a",
      materialKind: "A",
      cell,
      containerKind: "zone",
      containerId: zone.id,
      pickupAllowed: true,
      quantity: 1
    });
    registry.registerMaterial({
      kind: "material",
      id: "mat-b",
      materialKind: "B",
      cell: { col: 0, row: 0 },
      containerKind: "pawn",
      containerId: "pawn-0",
      pickupAllowed: true,
      quantity: 1
    });
    registry.updatePawn({
      kind: "pawn",
      id: "pawn-0",
      cell,
      behaviorState: "test",
      carriedMaterialId: "mat-b",
      saturation: 50,
      energy: 50
    });
    expect(() =>
      EntityLifecycle.pawnDropMaterial(registry, "pawn-0", "mat-b", cell, zone.id)
    ).toThrow();
  });

  it("when carrying and no stockpile zone, goal is not stockpile deposit", () => {
    const registry = createSeededEntityRegistry();
    for (const z of registry.listEntitiesByKind("zone")) {
      registry.removeZone(z.id);
    }
    const wr = new WorkRegistry();
    registry.registerMaterial({
      kind: "material",
      id: "mat-c",
      materialKind: "木柴",
      cell: { col: 4, row: 3 },
      containerKind: "pawn",
      containerId: "pawn-0",
      pickupAllowed: true,
      quantity: 2
    });
    registry.updatePawn({
      kind: "pawn",
      id: "pawn-0",
      cell: { col: 4, row: 3 },
      behaviorState: "test",
      carriedMaterialId: "mat-c",
      saturation: 50,
      energy: 50
    });
    const pawn: PawnState = {
      id: "pawn-0",
      name: "P",
      logicalCell: { col: 4, row: 3 },
      moveTarget: undefined,
      moveProgress01: 0,
      fillColor: 0,
      needs: { hunger: 10, rest: 10, recreation: 10 },
      currentGoal: undefined,
      currentAction: undefined,
      reservedTargetId: undefined,
      actionTimerSec: 0,
      debugLabel: ""
    };
    const d = chooseGoalDecision({
      grid: DEFAULT_WORLD_GRID,
      pawn,
      entityRegistry: registry,
      workRegistry: wr,
      claimableWorks: buildClaimablePendingWorks(registry, wr, DEFAULT_WORLD_GRID),
      pawnCarriesMaterial: true
    });
    expect(d.reason).not.toBe("stockpile-deposit");
    expect(d.workId).toBeUndefined();
  });

  it("tick completes stockpile deposit perform-work", () => {
    const entityRegistry = createSeededEntityRegistry();
    const workRegistry = new WorkRegistry();
    const zone = entityRegistry.listEntitiesByKind("zone")[0]!;
    const targetCell = { col: 18, row: 0 };
    entityRegistry.registerMaterial({
      kind: "material",
      id: "mat-haul",
      materialKind: "绳索",
      cell: targetCell,
      containerKind: "pawn",
      containerId: "pawn-0",
      pickupAllowed: true,
      quantity: 2
    });
    entityRegistry.updatePawn({
      kind: "pawn",
      id: "pawn-0",
      cell: targetCell,
      behaviorState: "test",
      carriedMaterialId: "mat-haul",
      saturation: 50,
      energy: 50
    });

    upsertPendingStockpileDepositWork(workRegistry, "pawn-0", zone.id, targetCell);
    workRegistry.setReservation({
      workId: "stockpile-deposit:pawn-0",
      pawnId: "pawn-0",
      lockedTarget: { kind: "cell", cell: targetCell },
      lockedAtMs: 0
    });
    workRegistry.setStatus("stockpile-deposit:pawn-0", "in_progress");

    const pawn: PawnState = {
      id: "pawn-0",
      name: "P",
      logicalCell: targetCell,
      moveTarget: undefined,
      moveProgress01: 0,
      fillColor: 0,
      needs: { hunger: 10, rest: 10, recreation: 10 },
      currentGoal: {
        kind: "work",
        reason: "stockpile-deposit",
        workId: "stockpile-deposit:pawn-0",
        targetId: "stockpile-deposit:pawn-0"
      },
      currentAction: {
        kind: "perform-work",
        targetId: "stockpile-deposit:pawn-0"
      },
      reservedTargetId: undefined,
      actionTimerSec: 10,
      debugLabel: ""
    };

    tickSimulation({
      pawns: [pawn],
      grid: DEFAULT_WORLD_GRID,
      simulationDt: 0.5,
      config: DEFAULT_SIM_CONFIG,
      rng: () => 0,
      entityRegistry,
      workRegistry,
      claimablePendingWorks: []
    });

    const placed = entityRegistry.getMaterial("mat-haul");
    expect(placed?.containerKind).toBe("zone");
    expect(placed?.containerId).toBe(zone.id);
    expect(workRegistry.getWork("stockpile-deposit:pawn-0")).toBeUndefined();
  });
});
