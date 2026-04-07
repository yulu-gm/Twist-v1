import type { PawnId, PawnState } from "../pawn-state";
import { isMoving } from "../pawn-state";
import {
  NIGHT_SLEEP_GOAL_SCORE_MULTIPLIER,
  PAWN_NEED_URGENCY_RULES,
  REST_SLEEP_PRIORITY_THRESHOLD
} from "../need/threshold-rules";
import type {
  GridCoord,
  InteractionPointKind,
  ReservationSnapshot,
  WorldGridConfig
} from "../map/world-grid";
import {
  findInteractionPointById,
  interactionPointsByKind,
  isInteractionPointReservedByOther,
  isWalkableCell
} from "../map/world-grid";
import { isCellOccupiedByOthers } from "../map/occupancy-manager";
import { findPathAStar } from "../map/a-star-pathfinding";
import { legalWanderNeighbors, pickWanderTarget, type WanderRng } from "./wander-planning";

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

/**
 * 睡眠候选过滤用：与 `WorldCore.restSpots` 字段子集同形。
 * 不直接 import `entity-types`（其与 `pawn-state` 形成经本文件的循环依赖）。
 */
export type RestSpotOwnershipForPlanning = Readonly<{
  buildingEntityId: string;
  ownerPawnId?: string;
}>;

export type ChooseGoalPlannerInput = Readonly<{
  grid: WorldGridConfig;
  pawn: PawnState;
  reservations: ReservationSnapshot;
  /** 当前时段；省略时按白天处理（不施加夜间睡眠得分乘数）。 */
  timePeriod?: "day" | "night";
  /**
   * 与 `world-sim-bridge` 衍生的 `world-rest-{buildingId}` 床点配合：
   * 已归属他人的床不进入本小人的睡眠候选；未传则不做归属过滤（纯模板交互点关卡兼容）。
   */
  restSpots?: readonly RestSpotOwnershipForPlanning[];
}>;

const WANDER_BASE_SCORE = 5;

const WORLD_REST_ID_PREFIX = "world-rest-";

function buildingEntityIdFromWorldRestBedPoint(point: {
  id: string;
  kind: InteractionPointKind;
}): string | undefined {
  if (point.kind !== "bed") return undefined;
  if (!point.id.startsWith(WORLD_REST_ID_PREFIX)) return undefined;
  return point.id.slice(WORLD_REST_ID_PREFIX.length);
}

/**
 * 模板床等非 world-rest 点：全员可候选。
 * `world-rest-{buildingId}`：传入 `restSpots` 时按归属过滤（缺条目不匹配则排除，避免与 WorldCore 脱节）；
 * 省略 `restSpots` 时不做归属过滤（纯模板交互点关卡兼容）。
 */
function bedInteractionAllowedForPawn(
  point: { id: string; kind: InteractionPointKind },
  pawnId: string,
  restSpots: readonly RestSpotOwnershipForPlanning[] | undefined
): boolean {
  if (point.kind !== "bed") return true;
  const buildingId = buildingEntityIdFromWorldRestBedPoint(point);
  if (buildingId === undefined) return true;
  if (restSpots === undefined) return true;
  const spot = restSpots.find((s) => s.buildingEntityId === buildingId);
  if (!spot) return false;
  if (spot.ownerPawnId === undefined) return true;
  return spot.ownerPawnId === pawnId;
}

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

/**
 * 与 oh-gen-doc「空闲无紧迫需求」一致：仅当某轴紧迫度达到警戒阈值以上时，该轴才参与目标打分，
 * 避免满饱食小人因邻格食物永远压过闲逛。
 */
function needScoreForGoal(pawn: PawnState, goal: GoalKind): number {
  switch (goal) {
    case "eat":
      return pawn.needs.hunger >= PAWN_NEED_URGENCY_RULES.hunger.warn ? pawn.needs.hunger : 0;
    case "sleep":
      return pawn.needs.rest >= PAWN_NEED_URGENCY_RULES.rest.warn ? pawn.needs.rest : 0;
    case "recreate":
      return pawn.needs.recreation >= PAWN_NEED_URGENCY_RULES.recreation.warn
        ? pawn.needs.recreation
        : 0;
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
    .filter((point) =>
      interactionKind !== "bed" ||
      bedInteractionAllowedForPawn(point, input.pawn.id, input.restSpots)
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
  logicalCellsByPawnId: ReadonlyMap<PawnId, GridCoord>,
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
  if (isCellOccupiedByOthers(logicalCellsByPawnId, step, pawn.id)) return undefined;
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

/** 与策划一致的闲逛：在合法邻格中随机选一格，路径为单步（不再对全图反复 A*）。 */
export function chooseWanderPath(
  grid: WorldGridConfig,
  pawn: PawnState,
  logicalCellsByPawnId: ReadonlyMap<PawnId, GridCoord>,
  rng: WanderRng
): GridCoord[] | undefined {
  const legal = legalWanderNeighbors(grid, pawn, logicalCellsByPawnId);
  const decision = pickWanderTarget(rng, legal);
  if (decision.kind !== "move") return undefined;
  return [decision.target];
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
  const wanderPath = chooseWanderPath(grid, pawn, logicalCellsByPawnId, rng);
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
