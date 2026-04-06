import type { PawnId, PawnState } from "../pawn-state";
import { isMoving } from "../pawn-state";
import {
  NIGHT_SLEEP_GOAL_SCORE_MULTIPLIER,
  REST_SLEEP_PRIORITY_THRESHOLD
} from "../need/threshold-rules";
import type { GridCoord, ReservationSnapshot, WorldGridConfig } from "../map/world-grid";
import {
  findInteractionPointById,
  interactionPointsByKind,
  isCellOccupiedByOthers,
  isInteractionPointReservedByOther,
  isWalkableCell,
  orthogonalNeighbors
} from "../map/world-grid";
import { legalWanderNeighbors, pickWanderTarget, type WanderRng } from "./wander-planning";

export type GoalKind = "eat" | "sleep" | "recreate" | "wander";
export type ActionKind = "reserve-target" | "move-to-target" | "use-target" | "idle";

export type GoalDecision = Readonly<{
  goal: GoalKind;
  score: number;
  targetId?: string;
  reason: string;
}>;

export type ChooseGoalPlannerInput = Readonly<{
  grid: WorldGridConfig;
  pawn: PawnState;
  reservations: ReservationSnapshot;
  /** 当前时段；省略时按白天处理（不施加夜间睡眠得分乘数）。 */
  timePeriod?: "day" | "night";
}>;

const WANDER_BASE_SCORE = 5;

function manhattanDistance(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function interactionKindForGoal(goal: GoalKind): "food" | "bed" | "recreation" | undefined {
  switch (goal) {
    case "eat":
      return "food";
    case "sleep":
      return "bed";
    case "recreate":
      return "recreation";
    default:
      return undefined;
  }
}

function needScoreForGoal(pawn: PawnState, goal: GoalKind): number {
  switch (goal) {
    case "eat":
      return pawn.needs.hunger;
    case "sleep":
      return pawn.needs.rest;
    case "recreate":
      return pawn.needs.recreation;
    case "wander":
      return WANDER_BASE_SCORE;
  }
}

function buildGoalDecision(input: ChooseGoalPlannerInput, goal: GoalKind): GoalDecision {
  const baseScore = needScoreForGoal(input.pawn, goal);
  const interactionKind = interactionKindForGoal(goal);
  if (!interactionKind) {
    return {
      goal,
      score: baseScore,
      reason: "fallback-wander"
    };
  }

  const candidates = interactionPointsByKind(input.grid, interactionKind)
    .filter(
      (point) => !isInteractionPointReservedByOther(input.reservations, point.id, input.pawn.id)
    )
    .sort(
      (left, right) =>
        manhattanDistance(input.pawn.logicalCell, left.cell) -
        manhattanDistance(input.pawn.logicalCell, right.cell)
    );

  const target = candidates[0];
  if (!target) {
    return {
      goal,
      score: -1,
      reason: `${goal}-unavailable`
    };
  }

  let score = Math.max(0, baseScore - manhattanDistance(input.pawn.logicalCell, target.cell) * 2);
  if (
    goal === "sleep" &&
    input.timePeriod === "night" &&
    input.pawn.needs.rest > REST_SLEEP_PRIORITY_THRESHOLD
  ) {
    score *= NIGHT_SLEEP_GOAL_SCORE_MULTIPLIER;
  }

  return {
    goal,
    score,
    targetId: target.id,
    reason: `${goal}-need-${baseScore}`
  };
}

export function chooseGoalDecision(input: ChooseGoalPlannerInput): GoalDecision {
  const candidates = (["eat", "sleep", "recreate", "wander"] as const)
    .map((goal) => buildGoalDecision(input, goal))
    .sort((left, right) => right.score - left.score);

  return candidates[0] ?? {
    goal: "wander",
    score: WANDER_BASE_SCORE,
    reason: "fallback-wander"
  };
}

export function targetCellForDecision(
  grid: WorldGridConfig,
  decision: GoalDecision
): GridCoord | undefined {
  if (!decision.targetId) return undefined;
  return findInteractionPointById(grid, decision.targetId)?.cell;
}

export function chooseStepTowardCell(
  grid: WorldGridConfig,
  pawn: PawnState,
  logicalCellsByPawnId: ReadonlyMap<PawnId, GridCoord>,
  targetCell: GridCoord
): GridCoord | undefined {
  if (
    pawn.logicalCell.col === targetCell.col &&
    pawn.logicalCell.row === targetCell.row
  ) {
    return undefined;
  }

  return orthogonalNeighbors(grid, pawn.logicalCell)
    .filter(
      (cell) =>
        isWalkableCell(grid, cell) && !isCellOccupiedByOthers(logicalCellsByPawnId, cell, pawn.id)
    )
    .sort(
      (left, right) =>
        manhattanDistance(left, targetCell) - manhattanDistance(right, targetCell)
    )[0];
}

export function chooseWanderStep(
  grid: WorldGridConfig,
  pawn: PawnState,
  logicalCellsByPawnId: ReadonlyMap<PawnId, GridCoord>,
  rng: WanderRng
): GridCoord | undefined {
  const legal = legalWanderNeighbors(grid, pawn, logicalCellsByPawnId);
  const decision = pickWanderTarget(rng, legal);
  return decision.kind === "move" ? decision.target : undefined;
}

export function canChooseNewGoal(pawn: PawnState): boolean {
  return !isMoving(pawn) && pawn.currentAction?.kind !== "use-target";
}
