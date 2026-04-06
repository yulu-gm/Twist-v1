/**
 * refactor-test：NEED-004（需求触底）场景级主验收入口；辅以 `scenario-runner.test.ts` 注册冒烟。
 */
import { describe, expect, it } from "vitest";
import { createHeadlessSim, hydrateScenario } from "../../src/headless";
import type { ScenarioDefinition } from "../../src/headless/scenario-types";
import { NEED_ZERO_FLOOR_SCENARIO } from "../../scenarios/need-zero-floor.scenario";

function setupScenario(definition: ScenarioDefinition) {
  const sim = createHeadlessSim({
    seed: definition.seed,
    worldGrid: definition.gridConfig
  });
  hydrateScenario(sim, definition);
  for (const deltaMs of definition.tickScheduleAfterHydrate ?? []) {
    sim.tick(deltaMs);
  }
  return sim;
}

const ENERGY_ZERO_FLOOR_SCENARIO: ScenarioDefinition = {
  ...NEED_ZERO_FLOOR_SCENARIO,
  seed: 0x4e_45_45_44_45,
  pawns: [
    {
      name: "ZeroEnergy",
      cell: NEED_ZERO_FLOOR_SCENARIO.pawns[0]!.cell,
      overrides: {
        satiety: 80,
        energy: 1,
        needs: { hunger: 15, rest: 99, recreation: 0 }
      }
    }
  ],
  expectations: [],
  manualAcceptance: undefined
};

describe("NEED-004 need-zero-floor", () => {
  it("locks hunger pressure at zero satiety without ever going negative", () => {
    const sim = setupScenario(NEED_ZERO_FLOOR_SCENARIO);

    const reachedZero = sim.runUntil(() => sim.getPawns()[0]?.satiety === 0, {
      maxTicks: 500
    });
    expect(reachedZero.reachedPredicate).toBe(true);

    const pawnAtZero = sim.getPawns()[0]!;
    expect(pawnAtZero.satiety).toBe(0);
    expect(pawnAtZero.satiety).toBeGreaterThanOrEqual(0);
    expect(pawnAtZero.needs.hunger).toBe(100);

    const hungerSettleTick = sim.getTickCount() + 60;
    sim.runUntil(() => sim.getTickCount() >= hungerSettleTick, { maxTicks: 60 });
    const stabilizedPawn = sim.getPawns()[0]!;
    expect(stabilizedPawn.satiety).toBe(0);
    expect(stabilizedPawn.satiety).toBeGreaterThanOrEqual(0);
    expect(stabilizedPawn.currentAction?.kind).not.toBe("use-target");

    const needEvents = sim.getSimEventCollector().getEventsByKind("pawn-need-changed");
    expect(needEvents.length).toBeGreaterThan(0);
    expect(
      needEvents.every(
        (event) => event.pawnId === "pawn-0" && event.after.satiety >= 0 && event.after.energy >= 0
      )
    ).toBe(true);
    expect(needEvents.some((event) => event.after.satiety === 0)).toBe(true);
  });

  it("locks fatigue pressure at zero energy without ever going negative", () => {
    const sim = setupScenario(ENERGY_ZERO_FLOOR_SCENARIO);

    const reachedZero = sim.runUntil(() => sim.getPawns()[0]?.energy === 0, {
      maxTicks: 500
    });
    expect(reachedZero.reachedPredicate).toBe(true);

    const pawnAtZero = sim.getPawns()[0]!;
    expect(pawnAtZero.energy).toBe(0);
    expect(pawnAtZero.energy).toBeGreaterThanOrEqual(0);
    expect(pawnAtZero.needs.rest).toBe(100);

    const energySettleTick = sim.getTickCount() + 60;
    sim.runUntil(() => sim.getTickCount() >= energySettleTick, { maxTicks: 60 });
    const stabilizedPawn = sim.getPawns()[0]!;
    expect(stabilizedPawn.energy).toBe(0);
    expect(stabilizedPawn.energy).toBeGreaterThanOrEqual(0);
    expect(stabilizedPawn.currentAction?.kind).not.toBe("use-target");

    const needEvents = sim.getSimEventCollector().getEventsByKind("pawn-need-changed");
    expect(needEvents.length).toBeGreaterThan(0);
    expect(
      needEvents.every(
        (event) => event.pawnId === "pawn-0" && event.after.energy >= 0 && event.after.satiety >= 0
      )
    ).toBe(true);
    expect(needEvents.some((event) => event.after.energy === 0)).toBe(true);
  });
});
