import { describe, expect, it } from "vitest";
import {
  chooseGoalDecision,
  type GoalDecision,
  type GoalKind
} from "../../src/game/goal-driven-planning";
import { createDefaultPawnStates, withPawnNeeds } from "../../src/game/pawn-state";
import {
  DEFAULT_WORLD_GRID,
  createReservationSnapshot,
  reserveInteractionPoint
} from "../../src/game/world-grid";

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
