/**
 * sim-loop：每帧模拟 tick 的纯函数实现（与 Phaser 无关）。
 *
 * 职责：需求推进 → 移动推进 → 使用计时 → 到达检测 → 目标/步骤决策
 * 调用方（GameScene）负责传入当前状态并写回返回值。
 */

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
import {
  canChooseNewGoal,
  chooseGoalDecision,
  chooseStepTowardCell,
  chooseWanderStep,
  targetCellForDecision
} from "./goal-driven-planning";
import {
  findInteractionPointById,
  releaseInteractionPoint,
  reserveInteractionPoint,
  type ReservationSnapshot,
  type WorldGridConfig
} from "./world-grid";
import type { SimConfig } from "./sim-config";
import type { WanderRng } from "./wander-planning";

export type SimTickInput = Readonly<{
  pawns: readonly PawnState[];
  reservations: ReservationSnapshot;
  grid: WorldGridConfig;
  simulationDt: number;
  config: SimConfig;
  rng: WanderRng;
}>;

export type SimTickOutput = Readonly<{
  pawns: readonly PawnState[];
  reservations: ReservationSnapshot;
  /** AI 事件日志，供调用方 console.info 输出。 */
  aiEvents: readonly string[];
}>;

export function tickSimulation(input: SimTickInput): SimTickOutput {
  const { grid, simulationDt, config, rng } = input;
  const aiEvents: string[] = [];
  let nextReservations = input.reservations;

  // --- 阶段 1：推进需求 + 移动 + 使用计时 ---
  let nextPawns = input.pawns.map((pawn) => {
    let updated = advanceNeeds(pawn, simulationDt, config.needGrowthPerSec);
    updated = finishMoveIfComplete(
      advanceMoveTowardTarget(updated, simulationDt, config.moveDurationSec)
    );

    if (updated.currentAction?.kind !== "use-target") {
      return updated;
    }

    const targetId = updated.currentAction.targetId ?? updated.reservedTargetId;
    const point = targetId ? findInteractionPointById(grid, targetId) : undefined;
    if (!targetId || !point) {
      return clearPawnIntent(updated);
    }

    updated = advancePawnActionTimer(updated, simulationDt);
    if (updated.actionTimerSec < point.useDurationSec) {
      return updated;
    }

    nextReservations = releaseInteractionPoint(nextReservations, point.id, updated.id);
    const completed = clearPawnIntent(applyNeedDelta(updated, point.needDelta));
    aiEvents.push(`[AI] ${updated.name}: completed ${point.kind} at ${point.id}`);
    return completed;
  });

  // --- 阶段 2：到达检测 → 切换 move-to-target 为 use-target ---
  nextPawns = nextPawns.map((pawn) => {
    if (isMoving(pawn) || pawn.currentAction?.kind !== "move-to-target") {
      return pawn;
    }

    const targetId = pawn.currentAction.targetId ?? pawn.reservedTargetId;
    const point = targetId ? findInteractionPointById(grid, targetId) : undefined;
    if (!targetId || !point) {
      return clearPawnIntent(pawn);
    }

    if (
      pawn.logicalCell.col === point.cell.col &&
      pawn.logicalCell.row === point.cell.row
    ) {
      return setPawnIntent(
        resetPawnActionTimer(pawn),
        pawn.currentGoal,
        { kind: "use-target", targetId: point.id },
        point.id
      );
    }

    return pawn;
  });

  // --- 阶段 3：目标评估 + 步骤决策 ---
  const plannedStepTargets = new Set<string>();

  nextPawns = nextPawns.map((pawn) => {
    if (!canChooseNewGoal(pawn)) {
      return pawn;
    }

    const logicalCells = logicalCellsByPawnId(nextPawns);
    const decision = chooseGoalDecision({
      grid,
      pawn,
      reservations: nextReservations
    });
    const previousLabel = pawn.debugLabel;

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

    const targetCell = targetCellForDecision(grid, decision);
    const point = decision.targetId
      ? findInteractionPointById(grid, decision.targetId)
      : undefined;
    if (!targetCell || !point) {
      return clearPawnIntent(pawn);
    }

    const reserved = reserveInteractionPoint(nextReservations, point.id, pawn.id);
    if (!reserved) {
      aiEvents.push(`[AI] ${pawn.name}: reserve failed for ${point.id}`);
      return setPawnIntent(
        pawn,
        { kind: "wander", reason: "reservation-failed" },
        { kind: "idle" },
        undefined
      );
    }
    nextReservations = reserved;

    if (
      pawn.logicalCell.col === targetCell.col &&
      pawn.logicalCell.row === targetCell.row
    ) {
      const using = setPawnIntent(
        resetPawnActionTimer(pawn),
        { kind: decision.goal, reason: decision.reason, targetId: point.id },
        { kind: "use-target", targetId: point.id },
        point.id
      );
      if (using.debugLabel !== previousLabel) {
        aiEvents.push(`[AI] ${using.name}: ${using.debugLabel} (${decision.reason})`);
      }
      return using;
    }

    const step = chooseStepTowardCell(grid, pawn, logicalCells, targetCell);
    if (!step) {
      nextReservations = releaseInteractionPoint(nextReservations, point.id, pawn.id);
      aiEvents.push(`[AI] ${pawn.name}: wait: no step toward ${point.id}`);
      return setPawnIntent(
        pawn,
        { kind: decision.goal, reason: "step-blocked", targetId: point.id },
        { kind: "idle", targetId: point.id },
        undefined
      );
    }

    const stepKey = `${step.col},${step.row}`;
    if (plannedStepTargets.has(stepKey)) {
      nextReservations = releaseInteractionPoint(nextReservations, point.id, pawn.id);
      return setPawnIntent(
        pawn,
        { kind: decision.goal, reason: "step-conflict", targetId: point.id },
        { kind: "idle", targetId: point.id },
        undefined
      );
    }

    plannedStepTargets.add(stepKey);
    const moving = setPawnIntent(
      beginMove(pawn, step),
      { kind: decision.goal, reason: decision.reason, targetId: point.id },
      { kind: "move-to-target", targetId: point.id },
      point.id
    );
    if (moving.debugLabel !== previousLabel) {
      aiEvents.push(`[AI] ${moving.name}: ${moving.debugLabel} (${decision.reason})`);
    }
    return moving;
  });

  return {
    pawns: nextPawns,
    reservations: nextReservations,
    aiEvents
  };
}
