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
  type PawnId,
  type PawnState
} from "../pawn-state";
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
  type GridCoord,
  type ReservationSnapshot,
  type WorldGridConfig
} from "../map/world-grid";
import type { SimConfig } from "./sim-config";
import type { WanderRng } from "./wander-planning";
import { HUNGER_INTERRUPT_THRESHOLD } from "../need/threshold-rules";
import type { WorkItemSnapshot } from "../work/work-types";
import { WORK_WALK_KINDS } from "../world-construct-tick";
import { timePeriodForMinute } from "../time/world-time";

export type SimTickInput = Readonly<{
  pawns: readonly PawnState[];
  reservations: ReservationSnapshot;
  grid: WorldGridConfig;
  simulationDt: number;
  config: SimConfig;
  rng: WanderRng;
  /**
   * 已认领工单锚格（建造/伐木/拾取/搬运）：优先于吃睡闲逛，沿格邻接走向锚格（与 WorldCore 工单一致）。
   */
  workWalkTargets?: ReadonlyMap<PawnId, GridCoord>;
  /** 当前世界工单快照；传入时才能在饥饿紧急时调用方側 {@link failWorkItem} 释放工单。 */
  worldWorkItems?: ReadonlyMap<string, WorkItemSnapshot>;
  /** 当前日内时段；与 {@link minuteOfDay} 二选一或同时传入时以本字段为准。 */
  timePeriod?: "day" | "night";
  /** 当前世界 `minuteOfDay`（0..1439）；用于推导时段或行为侧调试。 */
  minuteOfDay?: number;
}>;

export type SimWorkInterruptRequest = Readonly<{
  workItemId: string;
  pawnId: string;
  reason: string;
}>;

export type SimTickOutput = Readonly<{
  pawns: readonly PawnState[];
  reservations: ReservationSnapshot;
  /** AI 事件日志，供调用方 console.info 输出。 */
  aiEvents: readonly string[];
  /** 本帧因需求中断产生的工单失败请求，由编排器写入 WorldCore。 */
  workInterrupts?: readonly SimWorkInterruptRequest[];
}>;

export function findClaimedWalkWorkIdForPawn(
  pawnId: string,
  worldWorkItems: ReadonlyMap<string, WorkItemSnapshot> | undefined
): string | undefined {
  if (!worldWorkItems) return undefined;
  for (const w of worldWorkItems.values()) {
    if (w.status === "claimed" && w.claimedBy === pawnId && WORK_WALK_KINDS.has(w.kind)) {
      return w.id;
    }
  }
  return undefined;
}

function resolveSimTimePeriod(input: SimTickInput): "day" | "night" {
  if (input.timePeriod !== undefined) {
    return input.timePeriod;
  }
  if (input.minuteOfDay !== undefined) {
    return timePeriodForMinute(input.minuteOfDay);
  }
  return "day";
}

export function tickSimulation(input: SimTickInput): SimTickOutput {
  const { grid, simulationDt, config, rng, workWalkTargets, worldWorkItems } = input;
  const timePeriod = resolveSimTimePeriod(input);
  const aiEvents: string[] = [];
  let nextReservations = input.reservations;
  const workInterrupts: SimWorkInterruptRequest[] = [];

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

  // --- 阶段 2.5：饥饿紧急 → 放弃走向类工单（释放工单由编排器 failWorkItem）---
  const hungerInterruptedPawnIds = new Set<PawnId>();
  nextPawns = nextPawns.map((pawn) => {
    const walkWorkId = findClaimedWalkWorkIdForPawn(pawn.id, worldWorkItems);
    if (walkWorkId === undefined) return pawn;
    if (pawn.needs.hunger <= HUNGER_INTERRUPT_THRESHOLD) return pawn;
    workInterrupts.push({
      workItemId: walkWorkId,
      pawnId: pawn.id,
      reason: "need-interrupt-hunger"
    });
    hungerInterruptedPawnIds.add(pawn.id);
    aiEvents.push(`[AI] ${pawn.name}: need-interrupt-hunger → release work ${walkWorkId}`);
    return clearPawnIntent({
      ...pawn,
      moveTarget: undefined,
      moveProgress01: 0,
      activeWorkItemId: undefined,
      workTimerSec: 0
    });
  });

  // --- 阶段 3：目标评估 + 步骤决策 ---
  const plannedStepTargets = new Set<string>();

  nextPawns = nextPawns.map((pawn) => {
    if (!canChooseNewGoal(pawn)) {
      return pawn;
    }

    const previousLabel = pawn.debugLabel;
    const anchor = workWalkTargets?.get(pawn.id);
    if (anchor && !hungerInterruptedPawnIds.has(pawn.id)) {
      if (pawn.logicalCell.col === anchor.col && pawn.logicalCell.row === anchor.row) {
        return pawn;
      }
      const logicalCells = logicalCellsByPawnId(nextPawns);
      const step = chooseStepTowardCell(grid, pawn, logicalCells, anchor);
      if (!step) {
        aiEvents.push(`[AI] ${pawn.name}: construct: no step toward anchor`);
        return pawn;
      }
      const stepKey = `${step.col},${step.row}`;
      if (plannedStepTargets.has(stepKey)) {
        return pawn;
      }
      plannedStepTargets.add(stepKey);
      const moving = setPawnIntent(
        beginMove(pawn, step),
        { kind: "wander", reason: "construct-blueprint" },
        { kind: "move-to-target" },
        undefined
      );
      if (moving.debugLabel !== previousLabel) {
        aiEvents.push(`[AI] ${moving.name}: ${moving.debugLabel} (construct-blueprint)`);
      }
      return moving;
    }

    const logicalCells = logicalCellsByPawnId(nextPawns);
    const decision = chooseGoalDecision({
      grid,
      pawn,
      reservations: nextReservations,
      timePeriod
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
    aiEvents,
    workInterrupts: workInterrupts.length > 0 ? workInterrupts : undefined
  };
}
