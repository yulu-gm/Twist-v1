import { describe, expect, it } from "vitest";
import {
  collectGoalDecisionCandidates,
  chooseGoalDecision,
  nextStepFromPath,
  planPathTowardCell,
  type GoalDecision,
  type GoalKind
} from "../../src/game/behavior/goal-driven-planning";
import { createDefaultPawnStates, logicalCellsByPawnId, setPawnPath, withPawnNeeds } from "../../src/game/pawn-state";
import {
  coordKey,
  DEFAULT_WORLD_GRID,
  createReservationSnapshot,
  reserveInteractionPoint
} from "../../src/game/map/world-grid";

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

  it("planPathTowardCell 绕开 blockedCellKeys 生成完整 A* 路径", () => {
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>([
        coordKey({ col: 6, row: 5 }),
        coordKey({ col: 7, row: 5 }),
        coordKey({ col: 8, row: 5 })
      ])
    };
    const pawn = createDefaultPawnStates([{ col: 5, row: 5 }], ["T"])[0]!;
    const path = planPathTowardCell(grid, pawn, { col: 10, row: 5 });

    expect(path).toEqual([
      { col: 5, row: 4 },
      { col: 6, row: 4 },
      { col: 7, row: 4 },
      { col: 8, row: 4 },
      { col: 9, row: 4 },
      { col: 10, row: 4 },
      { col: 10, row: 5 }
    ]);
  });

  it("planPathTowardCell 在目标不可达时返回 undefined", () => {
    const target = { col: 10, row: 5 };
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>([
        coordKey({ col: 9, row: 5 }),
        coordKey({ col: 10, row: 4 }),
        coordKey({ col: 11, row: 5 }),
        coordKey({ col: 10, row: 6 })
      ])
    };
    const pawn = createDefaultPawnStates([{ col: 5, row: 5 }], ["T"])[0]!;

    expect(planPathTowardCell(grid, pawn, target)).toBeUndefined();
  });

  it("nextStepFromPath invalidates cached path when the next step becomes blocked", () => {
    const pawn = setPawnPath(
      createDefaultPawnStates([{ col: 5, row: 5 }], ["T"])[0]!,
      { col: 8, row: 5 },
      [
        { col: 6, row: 5 },
        { col: 7, row: 5 },
        { col: 8, row: 5 }
      ]
    );
    const blockedGrid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set<string>([coordKey({ col: 6, row: 5 })])
    };
    const logical = logicalCellsByPawnId([pawn]);

    expect(nextStepFromPath(blockedGrid, pawn, logical, { col: 8, row: 5 })).toBeUndefined();
  });

  it("nextStepFromPath ignores other pawns occupying the next step", () => {
    const pawn = setPawnPath(
      createDefaultPawnStates([{ col: 5, row: 5 }], ["T"])[0]!,
      { col: 8, row: 5 },
      [
        { col: 6, row: 5 },
        { col: 7, row: 5 },
        { col: 8, row: 5 }
      ]
    );
    const otherPawn = {
      ...createDefaultPawnStates([{ col: 6, row: 5 }], ["B"])[0]!,
      id: "pawn-blocker"
    };
    const logical = logicalCellsByPawnId([pawn, otherPawn]);

    expect(nextStepFromPath(DEFAULT_WORLD_GRID, pawn, logical, { col: 8, row: 5 })).toEqual({
      col: 6,
      row: 5
    });
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

  it("exposes ranked goal candidates for debug tracing", () => {
    const pawn = withPawnNeeds(
      createDefaultPawnStates([DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!], ["T"])[0]!,
      { hunger: 92, rest: 35, recreation: 15 }
    );

    const candidates = collectGoalDecisionCandidates({
      grid: DEFAULT_WORLD_GRID,
      pawn,
      reservations: createReservationSnapshot(),
      timePeriod: "day"
    });

    expect(candidates).toHaveLength(4);
    expect(candidates.map((candidate) => candidate.goal)).toEqual([
      "eat",
      "sleep",
      "wander",
      "recreate"
    ]);
    expect(candidates[0]?.score).toBeGreaterThan(candidates[1]?.score ?? 0);
    expect(candidates[0]?.targetAvailable).toBe(true);
    expect(candidates[0]?.blockedReason).toBeUndefined();
    expect(candidates[3]?.goal).toBe("recreate");
  });

  it("reports unavailable candidate reasons when all interaction points are reserved", () => {
    const reservations = DEFAULT_WORLD_GRID.interactionPoints.reduce(
      (snapshot, point, index) =>
        reserveInteractionPoint(snapshot, point.id, `other-${index}`) ?? snapshot,
      createReservationSnapshot()
    );
    const pawn = withPawnNeeds(
      createDefaultPawnStates([DEFAULT_WORLD_GRID.defaultSpawnPoints[0]!], ["T"])[0]!,
      { hunger: 88, rest: 90, recreation: 75 }
    );

    const candidates = collectGoalDecisionCandidates({
      grid: DEFAULT_WORLD_GRID,
      pawn,
      reservations
    });

    expect(candidates.find((candidate) => candidate.goal === "sleep")?.reason).toBe("sleep-unavailable");
    expect(candidates.find((candidate) => candidate.goal === "sleep")?.targetAvailable).toBe(false);
    expect(candidates.find((candidate) => candidate.goal === "sleep")?.blockedReason).toBe("no-target");
    expect(chooseGoalDecision({ grid: DEFAULT_WORLD_GRID, pawn, reservations }).goal).toBe("wander");
  });

  it("skips unreachable interaction targets when choosing a goal", () => {
    const blockedAroundRecreation1 = new Set<string>([
      coordKey({ col: 13, row: 6 }),
      coordKey({ col: 14, row: 5 }),
      coordKey({ col: 15, row: 6 }),
      coordKey({ col: 14, row: 7 })
    ]);
    const grid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: blockedAroundRecreation1
    };
    const pawn = withPawnNeeds(
      createDefaultPawnStates([{ col: 10, row: 3 }], ["T"])[0]!,
      { hunger: 20, rest: 10, recreation: 92 }
    );

    const candidates = collectGoalDecisionCandidates({
      grid,
      pawn,
      reservations: createReservationSnapshot()
    });
    const decision = chooseGoalDecision({
      grid,
      pawn,
      reservations: createReservationSnapshot()
    });

    expect(candidates.find((candidate) => candidate.goal === "recreate")?.targetAvailable).toBe(false);
    expect(candidates.find((candidate) => candidate.goal === "recreate")?.blockedReason).toBe("no-target");
    expect(decision.goal).toBe("wander");
  });
});
