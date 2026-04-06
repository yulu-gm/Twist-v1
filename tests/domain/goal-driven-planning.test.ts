import { describe, expect, it } from "vitest";
import {
  chooseGoalDecision,
  chooseStepTowardCell,
  type GoalDecision,
  type GoalKind
} from "../../src/game/behavior/goal-driven-planning";
import { createDefaultPawnStates, withPawnNeeds } from "../../src/game/pawn-state";
import {
  coordKey,
  DEFAULT_WORLD_GRID,
  createReservationSnapshot,
  reserveInteractionPoint
} from "../../src/game/map/world-grid";
import { logicalCellsByPawnId } from "../../src/game/pawn-state";

function expectGoalKind(decision: GoalDecision, kind: GoalKind): void {
  expect(decision.goal).toBe(kind);
  expect(decision.score).toBeGreaterThan(0);
}

describe("goal-driven-planning", () => {
  it("prefers eat when hunger is the highest need", () => {
    const pawn = withPawnNeeds(
      createDefaultPawnStates([DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!], ["T"])[0]!,
      { hunger: 92, rest: 20, recreation: 10 }
    );

    expectGoalKind(
      chooseGoalDecision({
        grid: DEFAULT_WORLD_GRID,
        pawn,
        reservations: createReservationSnapshot()
      }),
      "eat"
    );
  });

  it("prefers sleep when rest is the highest need", () => {
    const pawn = withPawnNeeds(
      createDefaultPawnStates([DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!], ["T"])[0]!,
      { hunger: 18, rest: 95, recreation: 12 }
    );

    expectGoalKind(
      chooseGoalDecision({
        grid: DEFAULT_WORLD_GRID,
        pawn,
        reservations: createReservationSnapshot()
      }),
      "sleep"
    );
  });

  it("prefers recreate when recreation is the highest need", () => {
    const pawn = withPawnNeeds(
      createDefaultPawnStates([DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!], ["T"])[0]!,
      { hunger: 21, rest: 15, recreation: 90 }
    );

    expectGoalKind(
      chooseGoalDecision({
        grid: DEFAULT_WORLD_GRID,
        pawn,
        reservations: createReservationSnapshot()
      }),
      "recreate"
    );
  });

  it("falls back when the best target is reserved by another pawn", () => {
    const foodPoint = DEFAULT_WORLD_GRID.interactionPoints.find((p) => p.kind === "food");
    const pawn = withPawnNeeds(
      createDefaultPawnStates([DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!], ["T"])[0]!,
      { hunger: 96, rest: 10, recreation: 10 }
    );
    const reserved = reserveInteractionPoint(
      createReservationSnapshot(),
      foodPoint!.id,
      "other-pawn"
    )!;

    const decision = chooseGoalDecision({
      grid: DEFAULT_WORLD_GRID,
      pawn,
      reservations: reserved
    });

    expect(decision.goal).not.toBe("eat");
  });

  it("prefers eat over sleep by day when hunger dominates unweighted scores", () => {
    const pawn = withPawnNeeds(
      createDefaultPawnStates([DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!], ["T"])[0]!,
      { hunger: 80, rest: 55, recreation: 10 }
    );
    const decision = chooseGoalDecision({
      grid: DEFAULT_WORLD_GRID,
      pawn,
      reservations: createReservationSnapshot(),
      timePeriod: "day"
    });
    expect(decision.goal).toBe("eat");
  });

  it("prefers sleep at night when rest urgency crosses weighted threshold over eat", () => {
    const pawn = withPawnNeeds(
      createDefaultPawnStates([DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!], ["T"])[0]!,
      { hunger: 80, rest: 55, recreation: 10 }
    );
    const decision = chooseGoalDecision({
      grid: DEFAULT_WORLD_GRID,
      pawn,
      reservations: createReservationSnapshot(),
      timePeriod: "night"
    });
    expect(decision.goal).toBe("sleep");
  });

  it("chooseStepTowardCell 不踏入 blockedCellKeys（如随机石格）", () => {
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>([coordKey({ col: 6, row: 5 })])
    };
    const pawn = createDefaultPawnStates([{ col: 5, row: 5 }], ["T"])[0]!;
    const logical = logicalCellsByPawnId([pawn]);
    const step = chooseStepTowardCell(grid, pawn, logical, { col: 10, row: 5 });
    expect(step).toEqual({ col: 4, row: 5 });
  });

  it("falls back to wander when no interaction target is available", () => {
    const reservations = DEFAULT_WORLD_GRID.interactionPoints.reduce(
      (snapshot, point, index) =>
        reserveInteractionPoint(snapshot, point.id, `other-${index}`) ?? snapshot,
      createReservationSnapshot()
    );
    const pawn = withPawnNeeds(
      createDefaultPawnStates([DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!], ["T"])[0]!,
      { hunger: 88, rest: 90, recreation: 75 }
    );

    const decision = chooseGoalDecision({
      grid: DEFAULT_WORLD_GRID,
      pawn,
      reservations
    });

    expect(decision.goal).toBe("wander");
  });
});
