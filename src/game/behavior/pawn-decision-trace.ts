/**
 * 小人决策轨迹快照类型与克隆工具：供行为 tick 与无头调试共用，避免 game 依赖 headless。
 */

import type { GoalDecisionCandidate } from "./goal-driven-planning";
import type { GridCoord } from "../map";
import type { PawnActionState, PawnGoalState, PawnState } from "../pawn-state";

export type PawnDecisionTraceState = Readonly<{
  logicalCell: GridCoord;
  needs: PawnState["needs"];
  currentGoal: PawnGoalState | undefined;
  currentAction: PawnActionState | undefined;
  activeWorkItemId?: string;
  debugLabel: string;
}>;

export type PawnDecisionResult = Readonly<{
  kind: "move" | "use-target" | "idle" | "blocked";
  targetId?: string;
  step?: GridCoord;
  blockedReason?: "reservation-failed" | "step-blocked" | "step-conflict" | "target-missing";
  /** `kind === "blocked"` 且因他小人占位时的调试信息（见 sim-loop）。 */
  blockerPawnId?: string;
  blockerPawnName?: string;
  blockerCell?: GridCoord;
}>;

export type PawnDecisionTrace = Readonly<{
  pawnId: string;
  pawnName: string;
  decisionSource: "claimed-work-anchor" | "goal-planner" | "continue-current" | "need-interrupt";
  before: PawnDecisionTraceState;
  after: PawnDecisionTraceState;
  candidates: readonly GoalDecisionCandidate[];
  selectedCandidate?: GoalDecisionCandidate;
  result: PawnDecisionResult;
  interruptReason?: string;
}>;

export function clonePawnDecisionState(pawn: PawnState): PawnDecisionTraceState {
  return {
    logicalCell: { col: pawn.logicalCell.col, row: pawn.logicalCell.row },
    needs: {
      hunger: pawn.needs.hunger,
      rest: pawn.needs.rest,
      recreation: pawn.needs.recreation
    },
    currentGoal: pawn.currentGoal ? { ...pawn.currentGoal } : undefined,
    currentAction: pawn.currentAction ? { ...pawn.currentAction } : undefined,
    activeWorkItemId: pawn.activeWorkItemId,
    debugLabel: pawn.debugLabel
  };
}
