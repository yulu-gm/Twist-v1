import { describe, expect, it } from "vitest";
import { tickSimulation } from "../src/game/sim-loop";
import { createSeededEntityRegistry } from "../src/game/entity-system";
import { DEFAULT_WORLD_GRID } from "../src/game/world-grid";
import { DEFAULT_SIM_CONFIG } from "../src/game/sim-config";
import { WorkRegistry } from "../src/game/work-system";
import type { PawnState } from "../src/game/pawn-state";

describe("need use-target completion", () => {
  it("eating decrements ground material quantity", () => {
    const entityRegistry = createSeededEntityRegistry();
    const berry = entityRegistry.listMaterialsOnGround().find((m) => m.materialKind === "浆果");
    expect(berry).toBeDefined();
    entityRegistry.updateMaterial({ ...berry!, quantity: 2, reservedByPawnId: "pawn-0" });

    const pawn: PawnState = {
      id: "pawn-0",
      name: "T",
      logicalCell: berry!.cell,
      moveTarget: undefined,
      moveProgress01: 0,
      fillColor: 0xff0000,
      needs: { hunger: 80, rest: 10, recreation: 10 },
      currentGoal: { kind: "eat", reason: "test", targetId: berry!.id },
      currentAction: { kind: "use-target", targetId: berry!.id },
      reservedTargetId: berry!.id,
      actionTimerSec: 10,
      debugLabel: "test"
    };

    tickSimulation({
      pawns: [pawn],
      grid: DEFAULT_WORLD_GRID,
      simulationDt: 0.1,
      config: DEFAULT_SIM_CONFIG,
      rng: () => 0,
      entityRegistry,
      workRegistry: new WorkRegistry(),
      claimablePendingWorks: []
    });

    const left = entityRegistry.getMaterial(berry!.id);
    expect(left?.quantity).toBe(1);
  });

  it("eating removes material when quantity reaches zero", () => {
    const entityRegistry = createSeededEntityRegistry();
    const berry = entityRegistry.listMaterialsOnGround().find((m) => m.materialKind === "浆果");
    expect(berry).toBeDefined();
    entityRegistry.updateMaterial({ ...berry!, quantity: 1, reservedByPawnId: "pawn-0" });

    const pawn: PawnState = {
      id: "pawn-0",
      name: "T",
      logicalCell: berry!.cell,
      moveTarget: undefined,
      moveProgress01: 0,
      fillColor: 0xff0000,
      needs: { hunger: 80, rest: 10, recreation: 10 },
      currentGoal: { kind: "eat", reason: "test", targetId: berry!.id },
      currentAction: { kind: "use-target", targetId: berry!.id },
      reservedTargetId: berry!.id,
      actionTimerSec: 10,
      debugLabel: "test"
    };

    tickSimulation({
      pawns: [pawn],
      grid: DEFAULT_WORLD_GRID,
      simulationDt: 0.1,
      config: DEFAULT_SIM_CONFIG,
      rng: () => 0,
      entityRegistry,
      workRegistry: new WorkRegistry(),
      claimablePendingWorks: []
    });

    expect(entityRegistry.getMaterial(berry!.id)).toBeUndefined();
    expect(entityRegistry.groundMaterialAtCell(berry!.cell)).toBeUndefined();
  });
});
