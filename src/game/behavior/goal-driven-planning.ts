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
  isInteractionPointReservedByOther,
  isWalkableCell
} from "../map/world-grid";
import { legalWanderNeighbors, pickWanderTarget, type WanderRng } from "./wander-planning";
import { findPathAStar } from "./a-star-pathfinding";

export type GoalKind = "eat" | "sleep" | "recreate" | "wander";
export type ActionKind = "reserve-target" | "move-to-target" | "use-target" | "idle";

export type GoalDecision = Readonly<{
  goal: GoalKind;
  score: number;
  targetId?: string;
  reason: string;
}>;

export type GoalDecisionCandidate = GoalDecision &
  Readonly<{
    targetAvailable: boolean;
    blockedReason?: "no-target";
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

function buildGoalDecisionCandidate(
  input: ChooseGoalPlannerInput,
  goal: GoalKind
): GoalDecisionCandidate {
  const baseScore = needScoreForGoal(input.pawn, goal);
  const interactionKind = interactionKindForGoal(goal);
  if (!interactionKind) {
    return {
      goal,
      score: baseScore,
      reason: "fallback-wander",
      targetAvailable: true
    };
  }

  const candidates = interactionPointsByKind(input.grid, interactionKind)
    .filter(
      (point) => !isInteractionPointReservedByOther(input.reservations, point.id, input.pawn.id)
    )
    .filter((point) => {
      if (
        input.pawn.logicalCell.col === point.cell.col &&
        input.pawn.logicalCell.row === point.cell.row
      ) {
        return true;
      }
      const path = planPathTowardCell(input.grid, input.pawn, point.cell);
      return path !== undefined;
    })
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
      reason: `${goal}-unavailable`,
      targetAvailable: false,
      blockedReason: "no-target"
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
    reason: `${goal}-need-${baseScore}`,
    targetAvailable: true
  };
}

export function collectGoalDecisionCandidates(
  input: ChooseGoalPlannerInput
): readonly GoalDecisionCandidate[] {
  return (["eat", "sleep", "recreate", "wander"] as const)
    .map((goal) => buildGoalDecisionCandidate(input, goal))
    .sort((left, right) => right.score - left.score);
}

export function chooseGoalDecision(input: ChooseGoalPlannerInput): GoalDecision {
  const candidates = collectGoalDecisionCandidates(input);

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

export function planPathTowardCell(
  grid: WorldGridConfig,
  pawn: PawnState,
  targetCell: GridCoord
): GridCoord[] | undefined {
  if (
    pawn.logicalCell.col === targetCell.col &&
    pawn.logicalCell.row === targetCell.row
  ) {
    return [];
  }

  return findPathAStar(grid, pawn.logicalCell, targetCell);
}

export function nextStepFromPath(
  grid: WorldGridConfig,
  pawn: PawnState,
  _logicalCellsByPawnId: ReadonlyMap<PawnId, GridCoord>,
  targetCell: GridCoord
): GridCoord | undefined {
  const pathTarget = pawn.pathTarget;
  const pathCells = pawn.pathCells;
  if (!pathTarget || !pathCells || pathCells.length === 0) return undefined;
  if (pathTarget.col !== targetCell.col || pathTarget.row !== targetCell.row) return undefined;
  const [step] = pathCells;
  if (!step) return undefined;
  const isAdjacent = manhattanDistance(pawn.logicalCell, step) === 1;
  if (!isAdjacent) return undefined;
  if (!isWalkableCell(grid, step)) return undefined;
  return step;
}

export function chooseStepTowardCell(
  grid: WorldGridConfig,
  pawn: PawnState,
  logicalCellsByPawnId: ReadonlyMap<PawnId, GridCoord>,
  targetCell: GridCoord
): GridCoord | undefined {
  const cached = nextStepFromPath(grid, pawn, logicalCellsByPawnId, targetCell);
  if (cached) return cached;
  const path = planPathTowardCell(grid, pawn, targetCell);
  const [step] = path ?? [];
  if (!step) return undefined;
  return step;
}

function allReachableWanderPaths(
  grid: WorldGridConfig,
  pawn: PawnState
): GridCoord[][] {
  const paths: GridCoord[][] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.columns; col += 1) {
      if (col === pawn.logicalCell.col && row === pawn.logicalCell.row) continue;
      const target = { col, row };
      if (!isWalkableCell(grid, target)) continue;
      const path = planPathTowardCell(grid, pawn, target);
      if (!path || path.length === 0) continue;
      paths.push(path);
    }
  }
  return paths.sort((left, right) => {
    const lengthDiff = right.length - left.length;
    if (lengthDiff !== 0) return lengthDiff;
    const leftLast = left[left.length - 1]!;
    const rightLast = right[right.length - 1]!;
    const rowDiff = leftLast.row - rightLast.row;
    if (rowDiff !== 0) return rowDiff;
    return leftLast.col - rightLast.col;
  });
}

export function chooseWanderPath(
  grid: WorldGridConfig,
  pawn: PawnState,
  rng: WanderRng
): GridCoord[] | undefined {
  const paths = allReachableWanderPaths(grid, pawn);
  if (paths.length === 0) return undefined;
  const preferred = paths.filter((path) => path.length > 1);
  const pool = preferred.length > 0 ? preferred : paths;
  const idx = Math.floor(rng() * pool.length);
  return pool[idx];
}

export function chooseWanderStep(
  grid: WorldGridConfig,
  pawn: PawnState,
  logicalCellsByPawnId: ReadonlyMap<PawnId, GridCoord>,
  rng: WanderRng
): GridCoord | undefined {
  if (pawn.pathCells && pawn.pathCells.length > 0) {
    return nextStepFromPath(grid, pawn, logicalCellsByPawnId, pawn.pathTarget ?? pawn.pathCells[pawn.pathCells.length - 1]!);
  }
  const wanderPath = chooseWanderPath(grid, pawn, rng);
  if (wanderPath && wanderPath.length > 0) {
    const [step] = wanderPath;
    if (step) {
      return step;
    }
  }
  const legal = legalWanderNeighbors(grid, pawn, logicalCellsByPawnId);
  const decision = pickWanderTarget(rng, legal);
  return decision.kind === "move" ? decision.target : undefined;
}

export function canChooseNewGoal(pawn: PawnState): boolean {
  return !isMoving(pawn) && pawn.currentAction?.kind !== "use-target";
}
