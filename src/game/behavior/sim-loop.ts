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
  clearPawnPath,
  clearPawnIntent,
  finishMoveIfComplete,
  isMoving,
  logicalCellsByPawnId,
  resetPawnActionTimer,
  setPawnPath,
  setPawnIntent,
  syncPawnPathToLogicalCell,
  type PawnId,
  type PawnState
} from "../pawn-state";
import {
  collectGoalDecisionCandidates,
  chooseGoalDecision,
  chooseWanderPath,
  nextStepFromPath,
  planPathTowardCell,
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
import {
  clonePawnDecisionState,
  type PawnDecisionResult,
  type PawnDecisionTrace
} from "../../headless/sim-debug-trace";

export type SimTickInput = Readonly<{
  pawns: readonly PawnState[];
  reservations: ReservationSnapshot;
  grid: WorldGridConfig;
  simulationDt: number;
  config: SimConfig;
  rng: WanderRng;
  /**
   * 已认领工单的操作站立格（锚格四邻可走格之一，由 {@link buildWorkWalkTargets} 注入）：
   * 优先于吃睡闲逛，沿格邻接走向该格（与 WorldCore 工单一致）。
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
  pawnDecisionTraces: readonly PawnDecisionTrace[];
  /** 本帧因需求中断产生的工单失败请求，由编排器写入 WorldCore。 */
  workInterrupts?: readonly SimWorkInterruptRequest[];
}>;

function decisionResultFromPawn(pawn: PawnState): PawnDecisionResult {
  if (pawn.currentAction?.kind === "use-target") {
    return {
      kind: "use-target",
      targetId: pawn.currentAction.targetId ?? pawn.reservedTargetId
    };
  }
  if (pawn.moveTarget) {
    return {
      kind: "move",
      step: { col: pawn.moveTarget.col, row: pawn.moveTarget.row },
      targetId: pawn.currentAction?.targetId ?? pawn.reservedTargetId
    };
  }
  return {
    kind: "idle",
    targetId: pawn.currentAction?.targetId ?? pawn.reservedTargetId
  };
}

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

function sameCell(left: GridCoord | undefined, right: GridCoord | undefined): boolean {
  if (!left || !right) return false;
  return left.col === right.col && left.row === right.row;
}

type PlannedStepResult = Readonly<{
  pawn: PawnState;
  step?: GridCoord;
  attemptedStep?: GridCoord;
  blockedReason?: "step-blocked" | "step-conflict";
  blockerPawnId?: PawnId;
  blockerPawnName?: string;
  blockerCell?: GridCoord;
}>;

function planNextStepTowardCell(
  grid: WorldGridConfig,
  pawn: PawnState,
  logicalCells: ReadonlyMap<PawnId, GridCoord>,
  _pawnsById: ReadonlyMap<PawnId, PawnState>,
  targetCell: GridCoord
): PlannedStepResult {
  const cached = nextStepFromPath(grid, pawn, logicalCells, targetCell);
  if (cached) {
    return { pawn, step: cached };
  }

  const replannedPath = planPathTowardCell(grid, pawn, targetCell);
  if (!replannedPath || replannedPath.length === 0) {
    return { pawn: clearPawnPath(pawn), blockedReason: "step-blocked" };
  }

  const repathedPawn = setPawnPath(pawn, targetCell, replannedPath);
  const [step] = replannedPath;
  if (!step) {
    return { pawn: repathedPawn, blockedReason: "step-blocked" };
  }
  return { pawn: repathedPawn, step };
}

export function tickSimulation(input: SimTickInput): SimTickOutput {
  const { grid, simulationDt, config, rng, workWalkTargets, worldWorkItems } = input;
  const timePeriod = resolveSimTimePeriod(input);
  const aiEvents: string[] = [];
  const pawnDecisionTraces: PawnDecisionTrace[] = [];
  let nextReservations = input.reservations;
  const workInterrupts: SimWorkInterruptRequest[] = [];
  const interruptReasons = new Map<PawnId, string>();

  // --- 阶段 1：推进需求 + 移动 + 使用计时 ---
  let nextPawns = input.pawns.map((pawn) => {
    let updated = advanceNeeds(pawn, simulationDt, config.needGrowthPerSec);
    updated = syncPawnPathToLogicalCell(
      finishMoveIfComplete(advanceMoveTowardTarget(updated, simulationDt, config.moveDurationSec))
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
        clearPawnPath(resetPawnActionTimer(pawn)),
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
    interruptReasons.set(pawn.id, "need-interrupt-hunger");
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
  nextPawns = nextPawns.map((pawn) => {
    const beforeState = clonePawnDecisionState(pawn);
    const candidateInput = {
      grid,
      pawn,
      reservations: nextReservations,
      timePeriod
    } as const;
    const candidates = collectGoalDecisionCandidates(candidateInput);
    const previousLabel = pawn.debugLabel;
    const logicalCells = logicalCellsByPawnId(nextPawns);
    const pawnsById = new Map(nextPawns.map((candidatePawn) => [candidatePawn.id, candidatePawn] as const));

    if (isMoving(pawn) || pawn.currentAction?.kind === "use-target") {
      pawnDecisionTraces.push({
        pawnId: pawn.id,
        pawnName: pawn.name,
        decisionSource: "continue-current",
        before: beforeState,
        after: clonePawnDecisionState(pawn),
        candidates,
        selectedCandidate: candidates[0],
        result: decisionResultFromPawn(pawn)
      });
      return pawn;
    }
    const anchor = workWalkTargets?.get(pawn.id);
    if (anchor && !hungerInterruptedPawnIds.has(pawn.id)) {
      if (sameCell(pawn.logicalCell, anchor)) {
        const arrived = clearPawnPath(pawn);
        pawnDecisionTraces.push({
          pawnId: pawn.id,
          pawnName: pawn.name,
          decisionSource: "claimed-work-anchor",
          before: beforeState,
          after: clonePawnDecisionState(arrived),
          candidates,
          selectedCandidate: candidates[0],
          result: { kind: "idle" }
        });
        return arrived;
      }
      const planned = planNextStepTowardCell(grid, pawn, logicalCells, pawnsById, anchor);
      if (!planned.step) {
        const waiting = setPawnIntent(
          planned.pawn,
          { kind: "wander", reason: "construct-blueprint" },
          { kind: "move-to-target" },
          undefined
        );
        aiEvents.push(`[AI] ${pawn.name}: construct: no step toward anchor`);
        pawnDecisionTraces.push({
          pawnId: pawn.id,
          pawnName: pawn.name,
          decisionSource: "claimed-work-anchor",
          before: beforeState,
          after: clonePawnDecisionState(waiting),
          candidates,
          selectedCandidate: candidates[0],
          result: {
            kind: "blocked",
            blockedReason: planned.blockedReason ?? "step-blocked",
            step: planned.attemptedStep,
            blockerPawnId: planned.blockerPawnId,
            blockerPawnName: planned.blockerPawnName,
            blockerCell: planned.blockerCell
          }
        });
        return waiting;
      }
      const moving = setPawnIntent(
        beginMove(planned.pawn, planned.step),
        { kind: "wander", reason: "construct-blueprint" },
        { kind: "move-to-target" },
        undefined
      );
      if (moving.debugLabel !== previousLabel) {
        aiEvents.push(`[AI] ${moving.name}: ${moving.debugLabel} (construct-blueprint)`);
      }
      pawnDecisionTraces.push({
        pawnId: pawn.id,
        pawnName: pawn.name,
        decisionSource: "claimed-work-anchor",
        before: beforeState,
        after: clonePawnDecisionState(moving),
        candidates,
        selectedCandidate: candidates[0],
        result: { kind: "move", step: { col: planned.step.col, row: planned.step.row } }
      });
      return moving;
    }

    const currentMoveTargetId =
      pawn.currentAction?.kind === "move-to-target"
        ? pawn.currentAction.targetId ?? pawn.reservedTargetId ?? pawn.currentGoal?.targetId
        : undefined;
    const currentMovePoint = currentMoveTargetId
      ? findInteractionPointById(grid, currentMoveTargetId)
      : undefined;
    if (pawn.currentAction?.kind === "move-to-target" && currentMovePoint && pawn.currentGoal) {
      if (sameCell(pawn.logicalCell, currentMovePoint.cell)) {
        const using = setPawnIntent(
          clearPawnPath(resetPawnActionTimer(pawn)),
          pawn.currentGoal,
          { kind: "use-target", targetId: currentMovePoint.id },
          currentMovePoint.id
        );
        pawnDecisionTraces.push({
          pawnId: pawn.id,
          pawnName: pawn.name,
          decisionSource: "continue-current",
          before: beforeState,
          after: clonePawnDecisionState(using),
          candidates,
          selectedCandidate:
            candidates.find((candidate) => candidate.targetId === currentMovePoint.id) ?? candidates[0],
          result: { kind: "use-target", targetId: currentMovePoint.id }
        });
        return using;
      }

      const planned = planNextStepTowardCell(grid, pawn, logicalCells, pawnsById, currentMovePoint.cell);
      if (!planned.step) {
        const waiting = setPawnIntent(
          planned.pawn,
          pawn.currentGoal,
          { kind: "move-to-target", targetId: currentMovePoint.id },
          currentMovePoint.id
        );
        pawnDecisionTraces.push({
          pawnId: pawn.id,
          pawnName: pawn.name,
          decisionSource: "continue-current",
          before: beforeState,
          after: clonePawnDecisionState(waiting),
          candidates,
          selectedCandidate:
            candidates.find((candidate) => candidate.targetId === currentMovePoint.id) ?? candidates[0],
          result: {
            kind: "blocked",
            blockedReason: planned.blockedReason ?? "step-blocked",
            targetId: currentMovePoint.id,
            step: planned.attemptedStep,
            blockerPawnId: planned.blockerPawnId,
            blockerPawnName: planned.blockerPawnName,
            blockerCell: planned.blockerCell
          }
        });
        return waiting;
      }

      const moving = setPawnIntent(
        beginMove(planned.pawn, planned.step),
        pawn.currentGoal,
        { kind: "move-to-target", targetId: currentMovePoint.id },
        currentMovePoint.id
      );
      pawnDecisionTraces.push({
        pawnId: pawn.id,
        pawnName: pawn.name,
        decisionSource: "continue-current",
        before: beforeState,
        after: clonePawnDecisionState(moving),
        candidates,
        selectedCandidate:
          candidates.find((candidate) => candidate.targetId === currentMovePoint.id) ?? candidates[0],
        result: {
          kind: "move",
          step: { col: planned.step.col, row: planned.step.row },
          targetId: currentMovePoint.id
        }
      });
      return moving;
    }

    if (
      pawn.currentAction?.kind === "move-to-target" &&
      pawn.currentGoal?.kind === "wander" &&
      pawn.pathTarget
    ) {
      const planned = planNextStepTowardCell(grid, pawn, logicalCells, pawnsById, pawn.pathTarget);
      if (!planned.step) {
        const waiting = setPawnIntent(
          planned.pawn,
          pawn.currentGoal,
          { kind: "move-to-target" },
          undefined
        );
        pawnDecisionTraces.push({
          pawnId: pawn.id,
          pawnName: pawn.name,
          decisionSource: "continue-current",
          before: beforeState,
          after: clonePawnDecisionState(waiting),
          candidates,
          selectedCandidate: candidates.find((candidate) => candidate.goal === "wander") ?? candidates[0],
          result: {
            kind: "blocked",
            blockedReason: planned.blockedReason ?? "step-blocked",
            step: planned.attemptedStep,
            blockerPawnId: planned.blockerPawnId,
            blockerPawnName: planned.blockerPawnName,
            blockerCell: planned.blockerCell
          }
        });
        return waiting;
      }

      const moving = setPawnIntent(
        beginMove(planned.pawn, planned.step),
        pawn.currentGoal,
        { kind: "move-to-target" },
        undefined
      );
      pawnDecisionTraces.push({
        pawnId: pawn.id,
        pawnName: pawn.name,
        decisionSource: "continue-current",
        before: beforeState,
        after: clonePawnDecisionState(moving),
        candidates,
        selectedCandidate: candidates.find((candidate) => candidate.goal === "wander") ?? candidates[0],
        result: { kind: "move", step: { col: planned.step.col, row: planned.step.row } }
      });
      return moving;
    }

    const decision = chooseGoalDecision(candidateInput);
    const selectedCandidate = candidates.find(
      (candidate) =>
        candidate.goal === decision.goal &&
        candidate.reason === decision.reason &&
        candidate.targetId === decision.targetId
    ) ?? candidates[0];
    const decisionSource = interruptReasons.has(pawn.id) ? "need-interrupt" : "goal-planner";

    if (decision.goal === "wander") {
      const wanderPath = chooseWanderPath(grid, pawn, rng);
      const target = wanderPath?.[wanderPath.length - 1];
      if (!wanderPath || !target) {
        const wandered = setPawnIntent(
          clearPawnPath(pawn),
          { kind: "wander", reason: decision.reason },
          { kind: "idle" },
          undefined
        );
        pawnDecisionTraces.push({
          pawnId: pawn.id,
          pawnName: pawn.name,
          decisionSource,
          before: beforeState,
          after: clonePawnDecisionState(wandered),
          candidates,
          selectedCandidate,
          result: { kind: "idle" },
          interruptReason: interruptReasons.get(pawn.id)
        });
        return wandered;
      }

      const repathed = setPawnPath(pawn, target, wanderPath);
      const [step] = wanderPath;
      if (!step) {
        const wandered = setPawnIntent(
          repathed,
          { kind: "wander", reason: decision.reason },
          { kind: "move-to-target" },
          undefined
        );
        pawnDecisionTraces.push({
          pawnId: pawn.id,
          pawnName: pawn.name,
          decisionSource,
          before: beforeState,
          after: clonePawnDecisionState(wandered),
          candidates,
          selectedCandidate,
          result: { kind: "blocked", blockedReason: "step-conflict" },
          interruptReason: interruptReasons.get(pawn.id)
        });
        return wandered;
      }

      const wandered = setPawnIntent(
        beginMove(repathed, step),
        { kind: "wander", reason: decision.reason },
        { kind: "move-to-target" },
        undefined
      );
      if (wandered.debugLabel !== previousLabel) {
        aiEvents.push(`[AI] ${wandered.name}: ${wandered.debugLabel} (${decision.reason})`);
      }
      pawnDecisionTraces.push({
        pawnId: pawn.id,
        pawnName: pawn.name,
        decisionSource,
        before: beforeState,
        after: clonePawnDecisionState(wandered),
        candidates,
        selectedCandidate,
        result: step
          ? { kind: "move", step: { col: step.col, row: step.row } }
          : { kind: "idle" },
        interruptReason: interruptReasons.get(pawn.id)
      });
      return wandered;
    }

    const targetCell = targetCellForDecision(grid, decision);
    const point = decision.targetId
      ? findInteractionPointById(grid, decision.targetId)
      : undefined;
    if (!targetCell || !point) {
      const cleared = clearPawnIntent(pawn);
      pawnDecisionTraces.push({
        pawnId: pawn.id,
        pawnName: pawn.name,
        decisionSource,
        before: beforeState,
        after: clonePawnDecisionState(cleared),
        candidates,
        selectedCandidate,
        result: { kind: "blocked", blockedReason: "target-missing" },
        interruptReason: interruptReasons.get(pawn.id)
      });
      return cleared;
    }

    const reserved = reserveInteractionPoint(nextReservations, point.id, pawn.id);
    if (!reserved) {
      aiEvents.push(`[AI] ${pawn.name}: reserve failed for ${point.id}`);
      const waiting = setPawnIntent(
        pawn,
        { kind: "wander", reason: "reservation-failed" },
        { kind: "idle" },
        undefined
      );
      pawnDecisionTraces.push({
        pawnId: pawn.id,
        pawnName: pawn.name,
        decisionSource,
        before: beforeState,
        after: clonePawnDecisionState(waiting),
        candidates,
        selectedCandidate,
        result: { kind: "blocked", blockedReason: "reservation-failed" },
        interruptReason: interruptReasons.get(pawn.id)
      });
      return waiting;
    }
    nextReservations = reserved;

    if (sameCell(pawn.logicalCell, targetCell)) {
      const using = setPawnIntent(
        clearPawnPath(resetPawnActionTimer(pawn)),
        { kind: decision.goal, reason: decision.reason, targetId: point.id },
        { kind: "use-target", targetId: point.id },
        point.id
      );
      if (using.debugLabel !== previousLabel) {
        aiEvents.push(`[AI] ${using.name}: ${using.debugLabel} (${decision.reason})`);
      }
      pawnDecisionTraces.push({
        pawnId: pawn.id,
        pawnName: pawn.name,
        decisionSource,
        before: beforeState,
        after: clonePawnDecisionState(using),
        candidates,
        selectedCandidate,
        result: { kind: "use-target", targetId: point.id },
        interruptReason: interruptReasons.get(pawn.id)
      });
      return using;
    }

    const planned = planNextStepTowardCell(grid, pawn, logicalCells, pawnsById, targetCell);
    if (!planned.step) {
      aiEvents.push(`[AI] ${pawn.name}: wait: no step toward ${point.id}`);
      const waiting = setPawnIntent(
        planned.pawn,
        { kind: decision.goal, reason: "step-blocked", targetId: point.id },
        { kind: "move-to-target", targetId: point.id },
        point.id
      );
      pawnDecisionTraces.push({
        pawnId: pawn.id,
        pawnName: pawn.name,
        decisionSource,
        before: beforeState,
        after: clonePawnDecisionState(waiting),
        candidates,
        selectedCandidate,
        result: {
          kind: "blocked",
          blockedReason: planned.blockedReason ?? "step-blocked",
          targetId: point.id,
          step: planned.attemptedStep,
          blockerPawnId: planned.blockerPawnId,
          blockerPawnName: planned.blockerPawnName,
          blockerCell: planned.blockerCell
        },
        interruptReason: interruptReasons.get(pawn.id)
      });
      return waiting;
    }

    const moving = setPawnIntent(
      beginMove(planned.pawn, planned.step),
      { kind: decision.goal, reason: decision.reason, targetId: point.id },
      { kind: "move-to-target", targetId: point.id },
      point.id
    );
    if (moving.debugLabel !== previousLabel) {
      aiEvents.push(`[AI] ${moving.name}: ${moving.debugLabel} (${decision.reason})`);
    }
    pawnDecisionTraces.push({
      pawnId: pawn.id,
      pawnName: pawn.name,
      decisionSource,
      before: beforeState,
      after: clonePawnDecisionState(moving),
      candidates,
      selectedCandidate,
      result: {
        kind: "move",
        step: { col: planned.step.col, row: planned.step.row },
        targetId: point.id
      },
      interruptReason: interruptReasons.get(pawn.id)
    });
    return moving;
  });

  return {
    pawns: nextPawns,
    reservations: nextReservations,
    aiEvents,
    pawnDecisionTraces,
    workInterrupts: workInterrupts.length > 0 ? workInterrupts : undefined
  };
}
