import type { PawnId, PawnState } from "./pawn-state";
import { isMoving } from "./pawn-state";
import type { BuildingEntity, EntityId, EntityRegistry } from "./entity-system";
import { gridCellForEntityTarget, groundMaterialMatchesEatNeed, primaryCellOfBuildingEntity } from "./entity-system";
import type { GridCoord, WorldGridConfig } from "./world-grid";
import { coordKey, orthogonalNeighbors } from "./world-grid";
import { astarNextStepTowardCell } from "./grid-pathfinding";
import {
  findStockpileDepositCell,
  removePendingStockpileDepositWorkIfPresent,
  STOCKPILE_DEPOSIT_PRIORITY,
  stockpileDepositWorkIdForPawn,
  upsertPendingStockpileDepositWork,
  WORK_TYPE_STOCKPILE_DEPOSIT
} from "./stockpile-deposit";
import type { WorkRegistry } from "./work-system";
import { legalWanderNeighbors, pickWanderTarget, type WanderRng } from "./wander-planning";

export type GoalKind = "eat" | "sleep" | "recreate" | "wander" | "work";
export type ActionKind = "reserve-target" | "move-to-target" | "use-target" | "idle" | "perform-work";

export type ClaimableWorkBrief = Readonly<{
  id: string;
  workType: string;
  targetCell: GridCoord;
  targetEntityId: string;
  priority: number;
}>;

export type GoalDecision = Readonly<{
  goal: GoalKind;
  score: number;
  targetId?: EntityId;
  workId?: string;
  reason: string;
}>;

type PlannerInput = Readonly<{
  grid: WorldGridConfig;
  pawn: PawnState;
  entityRegistry: EntityRegistry;
  workRegistry: WorkRegistry;
  claimableWorks: readonly ClaimableWorkBrief[];
  pawnCarriesMaterial: boolean;
}>;

const WANDER_BASE_SCORE = 5;

function manhattanDistance(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function isReservedByOther(reservedByPawnId: EntityId | undefined, pawnId: PawnId): boolean {
  return reservedByPawnId !== undefined && reservedByPawnId !== pawnId;
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
    case "work":
      return WANDER_BASE_SCORE;
  }
}

function buildGoalDecision(input: PlannerInput, goal: GoalKind): GoalDecision {
  const baseScore = needScoreForGoal(input.pawn, goal);
  const registry = input.entityRegistry;

  if (goal === "eat") {
    const candidates = registry
      .listMaterialsOnGround()
      .filter(
        (m) => groundMaterialMatchesEatNeed(m) && !isReservedByOther(m.reservedByPawnId, input.pawn.id)
      )
      .sort(
        (left, right) =>
          manhattanDistance(input.pawn.logicalCell, left.cell) -
          manhattanDistance(input.pawn.logicalCell, right.cell)
      );
    const target = candidates[0];
    if (!target) {
      return { goal, score: -1, reason: `${goal}-unavailable` };
    }
    return {
      goal,
      score: Math.max(0, baseScore - manhattanDistance(input.pawn.logicalCell, target.cell) * 2),
      targetId: target.id,
      reason: `${goal}-need-${baseScore}`
    };
  }

  if (goal === "sleep") {
    const candidates = registry
      .listEntitiesByKind("building")
      .filter(
        (b) => b.capabilities.includes("rest") && !isReservedByOther(b.reservedByPawnId, input.pawn.id)
      )
      .map((b) => ({ b, cell: primaryCellOfBuildingEntity(b) }))
      .filter((x): x is { b: BuildingEntity; cell: GridCoord } => x.cell !== undefined)
      .sort(
        (left, right) =>
          manhattanDistance(input.pawn.logicalCell, left.cell) -
          manhattanDistance(input.pawn.logicalCell, right.cell)
      );
    const chosen = candidates[0];
    if (!chosen) {
      return { goal, score: -1, reason: `${goal}-unavailable` };
    }
    return {
      goal,
      score: Math.max(
        0,
        baseScore - manhattanDistance(input.pawn.logicalCell, chosen.cell) * 2
      ),
      targetId: chosen.b.id,
      reason: `${goal}-need-${baseScore}`
    };
  }

  if (goal === "recreate") {
    const candidates = registry
      .listEntitiesByKind("building")
      .filter(
        (b) =>
          b.capabilities.includes("recreation") && !isReservedByOther(b.reservedByPawnId, input.pawn.id)
      )
      .map((b) => ({ b, cell: primaryCellOfBuildingEntity(b) }))
      .filter((x): x is { b: BuildingEntity; cell: GridCoord } => x.cell !== undefined)
      .sort(
        (left, right) =>
          manhattanDistance(input.pawn.logicalCell, left.cell) -
          manhattanDistance(input.pawn.logicalCell, right.cell)
      );
    const chosen = candidates[0];
    if (!chosen) {
      return { goal, score: -1, reason: `${goal}-unavailable` };
    }
    return {
      goal,
      score: Math.max(
        0,
        baseScore - manhattanDistance(input.pawn.logicalCell, chosen.cell) * 2
      ),
      targetId: chosen.b.id,
      reason: `${goal}-need-${baseScore}`
    };
  }

  return {
    goal,
    score: baseScore,
    reason: "fallback-wander"
  };
}

function estimateWorkTravelDistanceLocal(
  grid: WorldGridConfig,
  pawnCell: GridCoord,
  w: ClaimableWorkBrief
): number {
  if (w.workType === "pickup" || w.workType === WORK_TYPE_STOCKPILE_DEPOSIT) {
    return manhattanDistance(pawnCell, w.targetCell);
  }
  const neighbors = orthogonalNeighbors(grid, w.targetCell).filter((c) => {
    const blocked = grid.blockedCellKeys;
    if (blocked?.has(coordKey(c))) return false;
    return true;
  });
  if (!neighbors.length) return 999;
  return Math.min(...neighbors.map((c) => manhattanDistance(pawnCell, c)));
}

function buildWorkGoalDecision(input: PlannerInput): GoalDecision {
  const maxNeed = Math.max(
    input.pawn.needs.hunger,
    input.pawn.needs.rest,
    input.pawn.needs.recreation
  );
  if (maxNeed >= 60) {
    return { goal: "work", score: -1, reason: "needs-too-urgent" };
  }
  if (!input.pawnCarriesMaterial) {
    removePendingStockpileDepositWorkIfPresent(input.workRegistry, input.pawn.id);
  }
  if (input.pawnCarriesMaterial) {
    const pawnEnt = input.entityRegistry.getPawn(input.pawn.id);
    const matId = pawnEnt?.carriedMaterialId;
    const mat = matId ? input.entityRegistry.getMaterial(matId) : undefined;
    if (!matId || !mat) {
      return { goal: "work", score: -1, reason: "carrying-material-missing" };
    }
    const depositWid = stockpileDepositWorkIdForPawn(input.pawn.id);
    const existingDeposit = input.workRegistry.getWork(depositWid);
    if (existingDeposit?.status === "in_progress") {
      const dist = manhattanDistance(input.pawn.logicalCell, existingDeposit.targetCell);
      const score = Math.max(0, existingDeposit.priority - dist * 2);
      return {
        goal: "work",
        score,
        workId: depositWid,
        targetId: depositWid,
        reason: "stockpile-deposit"
      };
    }
    const slot = findStockpileDepositCell(
      input.grid,
      input.entityRegistry,
      input.workRegistry,
      input.pawn.id,
      input.pawn.logicalCell,
      mat.materialKind
    );
    if (!slot) {
      removePendingStockpileDepositWorkIfPresent(input.workRegistry, input.pawn.id);
      return { goal: "work", score: -1, reason: "no-storage-slot" };
    }
    upsertPendingStockpileDepositWork(
      input.workRegistry,
      input.pawn.id,
      slot.zoneId,
      slot.cell
    );
    const dist = manhattanDistance(input.pawn.logicalCell, slot.cell);
    const score = Math.max(0, STOCKPILE_DEPOSIT_PRIORITY - dist * 2);
    return {
      goal: "work",
      score,
      workId: depositWid,
      targetId: depositWid,
      reason: "stockpile-deposit"
    };
  }
  const works = input.claimableWorks;
  if (!works.length) {
    return { goal: "work", score: -1, reason: "no-work" };
  }
  let best: ClaimableWorkBrief | undefined;
  let bestScore = -1;
  for (const w of works) {
    const dist = estimateWorkTravelDistanceLocal(input.grid, input.pawn.logicalCell, w);
    const score = w.priority - dist * 2;
    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  }
  if (!best || bestScore < 0) {
    return { goal: "work", score: -1, reason: "no-work" };
  }
  return {
    goal: "work",
    score: bestScore,
    workId: best.id,
    targetId: best.id,
    reason: "work-available"
  };
}

export function chooseGoalDecision(input: PlannerInput): GoalDecision {
  const candidates = [
    ...(["eat", "sleep", "recreate", "wander"] as const).map((goal) => buildGoalDecision(input, goal)),
    buildWorkGoalDecision(input)
  ].sort((left, right) => right.score - left.score);

  return candidates[0] ?? {
    goal: "wander",
    score: WANDER_BASE_SCORE,
    reason: "fallback-wander"
  };
}

export function targetCellForDecision(
  _grid: WorldGridConfig,
  decision: GoalDecision,
  registry: EntityRegistry
): GridCoord | undefined {
  if (!decision.targetId) return undefined;
  return gridCellForEntityTarget(registry, decision.targetId);
}

export function chooseStepTowardCell(
  grid: WorldGridConfig,
  pawn: PawnState,
  logicalCellsByPawnId: ReadonlyMap<PawnId, GridCoord>,
  targetCell: GridCoord
): GridCoord | undefined {
  return astarNextStepTowardCell(
    grid,
    pawn.logicalCell,
    targetCell,
    logicalCellsByPawnId,
    pawn.id
  );
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
  return (
    !isMoving(pawn) &&
    pawn.currentAction?.kind !== "use-target" &&
    pawn.currentAction?.kind !== "perform-work"
  );
}
