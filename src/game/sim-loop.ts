/**
 * sim-loop：每帧模拟 tick 的纯函数实现（与 Phaser 无关）。
 *
 * 职责：需求推进 → 移动推进 → 使用计时 → 到达检测 → 目标/步骤决策
 * 调用方（GameScene）负责传入当前状态并写回返回值。
 */

import type { EntityRegistry } from "./entity-system";
import {
  EntityLifecycle,
  gridCellForEntityTarget,
  needInteractionSpecForTarget,
  ZONE_TYPE_STORAGE
} from "./entity-system";
import {
  advanceMoveTowardTarget,
  advanceNeeds,
  advancePawnActionTimer,
  applyNeedDelta,
  beginMove,
  clearPawnIntent,
  finishMoveIfComplete,
  isMoving,
  logicalCellsByPawnId,
  resetPawnActionTimer,
  setPawnIntent,
  type PawnState
} from "./pawn-state";
import type { ClaimableWorkBrief } from "./goal-driven-planning";
import {
  canChooseNewGoal,
  chooseGoalDecision,
  chooseStepTowardCell,
  chooseWanderStep,
  targetCellForDecision
} from "./goal-driven-planning";
import { coordKey, removeBlockedCellKey, type GridCoord, type WorldGridConfig } from "./world-grid";
import type { SimConfig } from "./sim-config";
import type { WanderRng } from "./wander-planning";
import type { WorkRegistry } from "./work-system";
import { WORK_TYPE_FELLING, WORK_TYPE_MINING, WORK_TYPE_PICKUP } from "./work-generation";
import { WORK_TYPE_STOCKPILE_DEPOSIT } from "./stockpile-deposit";
import { isAtWorkSite, pickWorkAnchorCell } from "./work-claim";

function releaseNeedEntityReservation(
  registry: EntityRegistry,
  targetId: string,
  pawnId: string
): void {
  const ent = registry.getEntity(targetId);
  if (!ent) return;
  if (ent.kind === "material" && ent.reservedByPawnId === pawnId) {
    registry.updateMaterial({ ...ent, reservedByPawnId: undefined });
  }
  if (ent.kind === "building" && ent.reservedByPawnId === pawnId) {
    registry.updateBuilding({ ...ent, reservedByPawnId: undefined });
  }
}

function isNeedTargetReservedByOther(
  reservedByPawnId: string | undefined,
  pawnId: string
): boolean {
  return reservedByPawnId !== undefined && reservedByPawnId !== pawnId;
}

function clearPawnIntentReleasingNeed(registry: EntityRegistry, pawn: PawnState): PawnState {
  const tid =
    pawn.reservedTargetId ?? pawn.currentGoal?.targetId ?? pawn.currentAction?.targetId;
  if (tid) {
    releaseNeedEntityReservation(registry, tid, pawn.id);
  }
  return clearPawnIntent(pawn);
}

function releaseInProgressWorkForPawn(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  pawnId: string
): void {
  const ids = workRegistry
    .listInProgress()
    .filter((w) => workRegistry.getReservation(w.id)?.pawnId === pawnId)
    .map((w) => w.id);
  for (const wid of ids) {
    workRegistry.clearReservation(wid);
    workRegistry.setStatus(wid, "pending");
    const w = workRegistry.getWork(wid);
    const tid = w?.targetEntityId;
    if (!tid) continue;
    const tree = entityRegistry.getTree(tid);
    if (tree) entityRegistry.registerTree({ ...tree, occupied: false });
    const rock = entityRegistry.getRock(tid);
    if (rock) entityRegistry.registerRock({ ...rock, occupied: false });
    const mat = entityRegistry.getMaterial(tid);
    if (mat?.reservedByPawnId === pawnId) {
      entityRegistry.updateMaterial({ ...mat, reservedByPawnId: undefined });
    }
  }
}

function claimWorkForPawn(
  entityRegistry: EntityRegistry,
  workRegistry: WorkRegistry,
  workId: string,
  pawnId: string
): boolean {
  const w = workRegistry.getWork(workId);
  if (!w || w.status !== "pending" || !w.targetEntityId) return false;
  if (w.workType === WORK_TYPE_STOCKPILE_DEPOSIT) {
    workRegistry.setReservation({
      workId: w.id,
      pawnId,
      lockedTarget: { kind: "cell", cell: w.targetCell },
      lockedAtMs: Date.now()
    });
    workRegistry.setStatus(w.id, "in_progress");
    return true;
  }
  workRegistry.setReservation({
    workId: w.id,
    pawnId,
    lockedTarget: { kind: "entity", entityId: w.targetEntityId },
    lockedAtMs: Date.now()
  });
  workRegistry.setStatus(w.id, "in_progress");
  const tree = entityRegistry.getTree(w.targetEntityId);
  if (tree) entityRegistry.registerTree({ ...tree, occupied: true });
  const rock = entityRegistry.getRock(w.targetEntityId);
  if (rock) entityRegistry.registerRock({ ...rock, occupied: true });
  const mat = entityRegistry.getMaterial(w.targetEntityId);
  if (mat) entityRegistry.updateMaterial({ ...mat, reservedByPawnId: pawnId });
  return true;
}

function workBriefFromOrder(work: NonNullable<ReturnType<WorkRegistry["getWork"]>>): ClaimableWorkBrief {
  return {
    id: work.id,
    workType: work.workType,
    targetCell: work.targetCell,
    targetEntityId: work.targetEntityId!,
    priority: work.priority
  };
}

function inProgressWorkIdForPawn(workRegistry: WorkRegistry, pawnId: string): string | undefined {
  for (const w of workRegistry.listInProgress()) {
    const r = workRegistry.getReservation(w.id);
    if (r?.pawnId === pawnId) return w.id;
  }
  return undefined;
}

function continueWorkTowardSite(
  pawn: PawnState,
  grid: WorldGridConfig,
  logicalCells: ReadonlyMap<string, GridCoord>,
  workRegistry: WorkRegistry,
  entityRegistry: EntityRegistry,
  workId: string,
  plannedStepTargets: Set<string>,
  aiEvents: string[],
  reason: string
): PawnState {
  const refreshed = workRegistry.getWork(workId);
  if (!refreshed) {
    return setPawnIntent(
      pawn,
      { kind: "wander", reason: "work-missing" },
      { kind: "idle" },
      undefined
    );
  }
  const r = workRegistry.getReservation(refreshed.id);
  if (refreshed.status !== "in_progress" || r?.pawnId !== pawn.id) {
    return setPawnIntent(pawn, { kind: "wander", reason: "work-lost" }, { kind: "idle" }, undefined);
  }
  const brief = workBriefFromOrder(refreshed);
  const anchor = pickWorkAnchorCell(grid, pawn.logicalCell, pawn.id, logicalCells, brief);
  const goalState = {
    kind: "work" as const,
    reason,
    workId: refreshed.id,
    targetId: refreshed.id
  };
  const previousLabel = pawn.debugLabel;

  if (!anchor) {
    releaseInProgressWorkForPawn(entityRegistry, workRegistry, pawn.id);
    aiEvents.push(`[AI] ${pawn.name}: wait: no anchor for work ${refreshed.id}`);
    return setPawnIntent(
      pawn,
      { kind: "wander", reason: "work-anchor-blocked" },
      { kind: "idle" },
      undefined
    );
  }

  if (isAtWorkSite(grid, pawn.logicalCell, brief)) {
    const using = setPawnIntent(
      resetPawnActionTimer(pawn),
      goalState,
      { kind: "perform-work", targetId: refreshed.id },
      refreshed.id
    );
    if (using.debugLabel !== previousLabel) {
      aiEvents.push(`[AI] ${using.name}: ${using.debugLabel} (${reason})`);
    }
    return using;
  }

  const step = chooseStepTowardCell(grid, pawn, logicalCells, anchor);
  if (!step) {
    releaseInProgressWorkForPawn(entityRegistry, workRegistry, pawn.id);
    aiEvents.push(`[AI] ${pawn.name}: wait: no step toward work ${refreshed.id}`);
    return setPawnIntent(
      pawn,
      { kind: "wander", reason: "work-step-blocked" },
      { kind: "idle" },
      undefined
    );
  }

  const stepKey = `${step.col},${step.row}`;
  if (plannedStepTargets.has(stepKey)) {
    releaseInProgressWorkForPawn(entityRegistry, workRegistry, pawn.id);
    return setPawnIntent(
      pawn,
      { kind: "wander", reason: "work-step-conflict" },
      { kind: "idle" },
      undefined
    );
  }

  plannedStepTargets.add(stepKey);
  const moving = setPawnIntent(
    beginMove(pawn, step),
    goalState,
    { kind: "move-to-target", targetId: refreshed.id },
    refreshed.id
  );
  if (moving.debugLabel !== previousLabel) {
    aiEvents.push(`[AI] ${moving.name}: ${moving.debugLabel} (${reason})`);
  }
  return moving;
}

export type SimTickInput = Readonly<{
  pawns: readonly PawnState[];
  grid: WorldGridConfig;
  simulationDt: number;
  config: SimConfig;
  rng: WanderRng;
  entityRegistry: EntityRegistry;
  workRegistry: WorkRegistry;
  claimablePendingWorks: readonly ClaimableWorkBrief[];
}>;

export type SimTickOutput = Readonly<{
  pawns: readonly PawnState[];
  aiEvents: readonly string[];
}>;

export function tickSimulation(input: SimTickInput): SimTickOutput {
  const { grid, simulationDt, config, rng, entityRegistry, workRegistry } = input;
  const aiEvents: string[] = [];

  let nextPawns = input.pawns.map((pawn) => {
    let updated = advanceNeeds(pawn, simulationDt, config.needGrowthPerSec);
    updated = finishMoveIfComplete(
      advanceMoveTowardTarget(updated, simulationDt, config.moveDurationSec)
    );

    if (updated.currentAction?.kind === "perform-work") {
      const workId = updated.currentAction.targetId ?? updated.currentGoal?.workId;
      if (!workId) {
        return clearPawnIntentReleasingNeed(entityRegistry, updated);
      }
      const work = workRegistry.getWork(workId);
      if (!work || work.status !== "in_progress") {
        releaseInProgressWorkForPawn(entityRegistry, workRegistry, updated.id);
        return clearPawnIntentReleasingNeed(entityRegistry, updated);
      }
      const r = workRegistry.getReservation(workId);
      if (r?.pawnId !== updated.id) {
        return clearPawnIntentReleasingNeed(entityRegistry, updated);
      }
      updated = advancePawnActionTimer(updated, simulationDt);
      if (updated.actionTimerSec < config.workPerformDurationSec) {
        return updated;
      }

      const tid = work.targetEntityId!;
      if (work.workType === WORK_TYPE_FELLING) {
        EntityLifecycle.fellingCompleteSpawnWood(entityRegistry, tid, work.targetCell);
      } else if (work.workType === WORK_TYPE_MINING) {
        EntityLifecycle.miningCompleteSpawnStone(entityRegistry, tid, work.targetCell);
        removeBlockedCellKey(grid, work.targetCell);
      } else if (work.workType === WORK_TYPE_PICKUP) {
        EntityLifecycle.pawnPickupMaterial(entityRegistry, updated.id, tid);
      } else if (work.workType === WORK_TYPE_STOCKPILE_DEPOSIT) {
        const carriedId = entityRegistry.getPawn(updated.id)?.carriedMaterialId;
        const zoneEnt = entityRegistry.getEntity(work.targetEntityId!);
        if (
          !carriedId ||
          !zoneEnt ||
          zoneEnt.kind !== "zone" ||
          zoneEnt.zoneType !== ZONE_TYPE_STORAGE ||
          !zoneEnt.cellKeys.includes(coordKey(work.targetCell))
        ) {
          workRegistry.removeWork(workId);
          releaseInProgressWorkForPawn(entityRegistry, workRegistry, updated.id);
          return clearPawnIntentReleasingNeed(entityRegistry, updated);
        }
        EntityLifecycle.pawnDropMaterial(
          entityRegistry,
          updated.id,
          carriedId,
          work.targetCell,
          zoneEnt.id
        );
      }
      workRegistry.removeWork(workId);
      aiEvents.push(`[AI] ${updated.name}: completed work ${workId}`);
      return clearPawnIntentReleasingNeed(entityRegistry, updated);
    }

    if (updated.currentAction?.kind !== "use-target") {
      return updated;
    }

    const targetId = updated.currentAction.targetId ?? updated.reservedTargetId;
    const gk = updated.currentGoal?.kind;
    if (
      !targetId ||
      (gk !== "eat" && gk !== "sleep" && gk !== "recreate")
    ) {
      return clearPawnIntentReleasingNeed(entityRegistry, updated);
    }
    const spec = needInteractionSpecForTarget(entityRegistry, targetId, gk);
    if (!spec) {
      return clearPawnIntentReleasingNeed(entityRegistry, updated);
    }

    updated = advancePawnActionTimer(updated, simulationDt);
    if (updated.actionTimerSec < spec.useDurationSec) {
      return updated;
    }

    releaseNeedEntityReservation(entityRegistry, targetId, updated.id);
    let afterNeeds = applyNeedDelta(updated, spec.needDelta);
    if (gk === "eat") {
      const mat = entityRegistry.getMaterial(targetId);
      if (mat && mat.containerKind === "map") {
        if (mat.quantity > 1) {
          entityRegistry.updateMaterial({
            ...mat,
            quantity: mat.quantity - 1,
            reservedByPawnId: undefined
          });
        } else {
          entityRegistry.removeMaterial(targetId);
        }
      }
    }
    const completed = clearPawnIntent(afterNeeds);
    aiEvents.push(`[AI] ${updated.name}: completed ${gk} at ${targetId}`);
    return completed;
  });

  nextPawns = nextPawns.map((pawn) => {
    if (isMoving(pawn) || pawn.currentAction?.kind !== "move-to-target") {
      return pawn;
    }

    if (pawn.currentGoal?.kind === "work" && pawn.currentGoal.workId) {
      const work = workRegistry.getWork(pawn.currentGoal.workId);
      if (!work || work.status !== "in_progress") {
        releaseInProgressWorkForPawn(entityRegistry, workRegistry, pawn.id);
        return clearPawnIntentReleasingNeed(entityRegistry, pawn);
      }
      const r = workRegistry.getReservation(work.id);
      if (r?.pawnId !== pawn.id) {
        return clearPawnIntentReleasingNeed(entityRegistry, pawn);
      }
      const brief = workBriefFromOrder(work);
      if (isAtWorkSite(grid, pawn.logicalCell, brief)) {
        return setPawnIntent(
          resetPawnActionTimer(pawn),
          {
            kind: "work",
            reason: pawn.currentGoal.reason,
            workId: work.id,
            targetId: work.id
          },
          { kind: "perform-work", targetId: work.id },
          work.id
        );
      }
      return pawn;
    }

    const targetId = pawn.currentAction.targetId ?? pawn.reservedTargetId;
    const ng = pawn.currentGoal?.kind;
    if (
      targetId &&
      (ng === "eat" || ng === "sleep" || ng === "recreate")
    ) {
      const cell = gridCellForEntityTarget(entityRegistry, targetId);
      if (!cell) {
        return clearPawnIntentReleasingNeed(entityRegistry, pawn);
      }
      if (pawn.logicalCell.col === cell.col && pawn.logicalCell.row === cell.row) {
        return setPawnIntent(
          resetPawnActionTimer(pawn),
          pawn.currentGoal,
          { kind: "use-target", targetId },
          targetId
        );
      }
      return pawn;
    }

    return clearPawnIntentReleasingNeed(entityRegistry, pawn);
  });

  const plannedStepTargets = new Set<string>();

  nextPawns = nextPawns.map((pawn) => {
    if (!canChooseNewGoal(pawn)) {
      return pawn;
    }

    const logicalCells = logicalCellsByPawnId(nextPawns);
    const pawnCarriesMaterial = entityRegistry.getPawn(pawn.id)?.carriedMaterialId != null;
    const previousLabel = pawn.debugLabel;

    const committedWorkId = inProgressWorkIdForPawn(workRegistry, pawn.id);
    if (committedWorkId) {
      const reason =
        pawn.currentGoal?.kind === "work" ? pawn.currentGoal.reason : "work-committed";
      return continueWorkTowardSite(
        pawn,
        grid,
        logicalCells,
        workRegistry,
        entityRegistry,
        committedWorkId,
        plannedStepTargets,
        aiEvents,
        reason
      );
    }

    const decision = chooseGoalDecision({
      grid,
      pawn,
      entityRegistry,
      workRegistry,
      claimableWorks: input.claimablePendingWorks,
      pawnCarriesMaterial
    });

    if (decision.goal === "wander") {
      const step = chooseWanderStep(grid, pawn, logicalCells, rng);
      const wandered = setPawnIntent(
        step ? beginMove(pawn, step) : pawn,
        { kind: "wander", reason: decision.reason },
        step ? { kind: "move-to-target" } : { kind: "idle" },
        undefined
      );
      if (wandered.debugLabel !== previousLabel) {
        aiEvents.push(`[AI] ${wandered.name}: ${wandered.debugLabel} (${decision.reason})`);
      }
      return wandered;
    }

    if (decision.goal === "work" && decision.workId) {
      const work = workRegistry.getWork(decision.workId);
      if (!work) {
        return setPawnIntent(
          pawn,
          { kind: "wander", reason: "work-missing" },
          { kind: "idle" },
          undefined
        );
      }

      if (work.status === "pending") {
        if (!claimWorkForPawn(entityRegistry, workRegistry, decision.workId, pawn.id)) {
          aiEvents.push(`[AI] ${pawn.name}: claim failed ${decision.workId}`);
          return setPawnIntent(
            pawn,
            { kind: "wander", reason: "claim-failed" },
            { kind: "idle" },
            undefined
          );
        }
      } else if (work.status === "in_progress") {
        const r = workRegistry.getReservation(work.id);
        if (r?.pawnId !== pawn.id) {
          return setPawnIntent(
            pawn,
            { kind: "wander", reason: "work-taken" },
            { kind: "idle" },
            undefined
          );
        }
      } else {
        return setPawnIntent(
          pawn,
          { kind: "wander", reason: "work-unavailable" },
          { kind: "idle" },
          undefined
        );
      }

      const refreshed = workRegistry.getWork(decision.workId);
      if (!refreshed) {
        return setPawnIntent(
          pawn,
          { kind: "wander", reason: "work-missing" },
          { kind: "idle" },
          undefined
        );
      }
      return continueWorkTowardSite(
        pawn,
        grid,
        logicalCells,
        workRegistry,
        entityRegistry,
        refreshed.id,
        plannedStepTargets,
        aiEvents,
        decision.reason
      );
    }

    const targetCell = targetCellForDecision(grid, decision, entityRegistry);
    const entityId = decision.targetId;
    if (!targetCell || !entityId) {
      return clearPawnIntentReleasingNeed(entityRegistry, pawn);
    }
    const ent = entityRegistry.getEntity(entityId);
    if (!ent || (ent.kind !== "material" && ent.kind !== "building")) {
      return clearPawnIntentReleasingNeed(entityRegistry, pawn);
    }
    if (isNeedTargetReservedByOther(ent.reservedByPawnId, pawn.id)) {
      aiEvents.push(`[AI] ${pawn.name}: reserve failed for ${entityId}`);
      return setPawnIntent(
        pawn,
        { kind: "wander", reason: "reservation-failed" },
        { kind: "idle" },
        undefined
      );
    }
    if (ent.kind === "material") {
      entityRegistry.updateMaterial({ ...ent, reservedByPawnId: pawn.id });
    } else {
      entityRegistry.updateBuilding({ ...ent, reservedByPawnId: pawn.id });
    }

    if (
      pawn.logicalCell.col === targetCell.col &&
      pawn.logicalCell.row === targetCell.row
    ) {
      const using = setPawnIntent(
        resetPawnActionTimer(pawn),
        { kind: decision.goal, reason: decision.reason, targetId: entityId },
        { kind: "use-target", targetId: entityId },
        entityId
      );
      if (using.debugLabel !== previousLabel) {
        aiEvents.push(`[AI] ${using.name}: ${using.debugLabel} (${decision.reason})`);
      }
      return using;
    }

    const step = chooseStepTowardCell(grid, pawn, logicalCells, targetCell);
    if (!step) {
      releaseNeedEntityReservation(entityRegistry, entityId, pawn.id);
      aiEvents.push(`[AI] ${pawn.name}: wait: no step toward ${entityId}`);
      return setPawnIntent(
        pawn,
        { kind: decision.goal, reason: "step-blocked", targetId: entityId },
        { kind: "idle", targetId: entityId },
        undefined
      );
    }

    const stepKey = `${step.col},${step.row}`;
    if (plannedStepTargets.has(stepKey)) {
      releaseNeedEntityReservation(entityRegistry, entityId, pawn.id);
      return setPawnIntent(
        pawn,
        { kind: decision.goal, reason: "step-conflict", targetId: entityId },
        { kind: "idle", targetId: entityId },
        undefined
      );
    }

    plannedStepTargets.add(stepKey);
    const moving = setPawnIntent(
      beginMove(pawn, step),
      { kind: decision.goal, reason: decision.reason, targetId: entityId },
      { kind: "move-to-target", targetId: entityId },
      entityId
    );
    if (moving.debugLabel !== previousLabel) {
      aiEvents.push(`[AI] ${moving.name}: ${moving.debugLabel} (${decision.reason})`);
    }
    return moving;
  });

  return {
    pawns: nextPawns,
    aiEvents
  };
}
