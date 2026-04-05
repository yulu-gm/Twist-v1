/**
 * 需求打断工作：在工作进行中因饥饿临界优先进食，释放工单并切入 eating，恢复后可再次认领。
 */

import { scoreActions } from "../behavior/action-scorer";
import type { BehaviorContext } from "../behavior/behavior-context";
import {
  canBeInterrupted,
  transition,
  type BehaviorFSM,
  type BehaviorState
} from "../behavior/behavior-state-machine";
import type { NeedSnapshot } from "../need/need-profile";
import { EATING_SATIETY_RECOVERY_PER_SECOND } from "../need/need-evolution-engine";
import { settleEating, isNeedSatisfied } from "../need/satisfaction-settler";
import { needActionSuggestion, WARNING_THRESHOLD } from "../need/threshold-rules";
import { claimWork, releaseWork, type ClaimResult } from "../work/work-scheduler";
import type { WorkRegistry } from "../work/work-registry";
import type { WorkOrder } from "../work/work-types";

/**
 * 与 {@link DEFAULT_BEHAVIOR_TRANSITIONS} 中 `working → eating` 的 `need-interrupt-hunger` 一致。
 */
export const NEED_INTERRUPT_TO_EAT_PRIORITY = 70;

export type NeedInterruptTickInput = Readonly<{
  fsm: BehaviorFSM;
  workRegistry: WorkRegistry;
  workId: string;
  pawnId: string;
  profile: NeedSnapshot;
  /**
   * 供 {@link scoreActions} 使用；`candidateWorks` 须包含当前执行工单（可比 registry 中快照更新 status 以便评分）。
   */
  scoringContext: BehaviorContext;
}>;

export type NeedInterruptTickResult =
  | Readonly<{ kind: "not-working" }>
  | Readonly<{ kind: "work-not-held" }>
  | Readonly<{ kind: "eat-not-prioritized" }>
  | Readonly<{ kind: "not-interruptible" }>
  | Readonly<{ kind: "released-and-eating"; previousState: BehaviorState }>;

function eatPreferredOverWork(
  profile: NeedSnapshot,
  scoringContext: BehaviorContext
): boolean {
  const suggestion = needActionSuggestion(profile);
  const ranked = scoreActions(scoringContext);
  return suggestion.actionKind === "eat" || ranked[0]?.kind === "eat";
}

/**
 * 单 tick：若处于 working、持有工单、且吃优先于工作并可打断，则 {@link releaseWork} 并 `eating` 转移。
 */
export function handleNeedInterruptTick(input: NeedInterruptTickInput): NeedInterruptTickResult {
  const { fsm, workRegistry, workId, pawnId, profile, scoringContext } = input;

  if (fsm.currentState !== "working") {
    return { kind: "not-working" };
  }

  const order = workRegistry.orders.get(workId);
  if (!order || order.status !== "claimed" || order.claimedByPawnId !== pawnId) {
    return { kind: "work-not-held" };
  }

  if (!eatPreferredOverWork(profile, scoringContext)) {
    return { kind: "eat-not-prioritized" };
  }

  if (!canBeInterrupted(fsm, NEED_INTERRUPT_TO_EAT_PRIORITY)) {
    return { kind: "not-interruptible" };
  }

  releaseWork(workRegistry, workId, pawnId);

  const tr = transition(fsm, "eating", { interruptPriority: NEED_INTERRUPT_TO_EAT_PRIORITY });
  if (!tr.ok) {
    throw new Error(`need-interrupt-flow: transition failed after release: ${tr.reason}`);
  }

  return { kind: "released-and-eating", previousState: tr.previousState };
}

export type RunNeedInterruptScenarioInput = NeedInterruptTickInput &
  Readonly<{
    /** 未指定时按补至饱食 ≥ {@link WARNING_THRESHOLD} 估算。 */
    eatingDurationSeconds?: number;
  }>;

export type RunNeedInterruptScenarioResult =
  | Readonly<{ kind: "tick-failed"; tick: NeedInterruptTickResult }>
  | Readonly<{
      kind: "ok";
      profileAfterEating: NeedSnapshot;
      claimAfterResume: ClaimResult;
    }>;

function resolvedEatingDurationSeconds(
  profile: NeedSnapshot,
  override?: number
): number {
  if (override !== undefined && override >= 0) {
    return override;
  }
  const needGain = Math.max(0, WARNING_THRESHOLD - profile.satiety) + 0.001;
  return Math.ceil(needGain / EATING_SATIETY_RECOVERY_PER_SECOND);
}

/**
 * 完整场景：打断 → 进食结算 → 回到 idle → 再次 {@link claimWork} 同一 `workId`。
 */
export function runNeedInterruptScenario(
  input: RunNeedInterruptScenarioInput
): RunNeedInterruptScenarioResult {
  const tick = handleNeedInterruptTick(input);
  if (tick.kind !== "released-and-eating") {
    return { kind: "tick-failed", tick };
  }

  const duration = resolvedEatingDurationSeconds(
    input.profile,
    input.eatingDurationSeconds
  );
  let profileAfterEating = settleEating(input.profile, duration);
  if (!isNeedSatisfied(profileAfterEating, "hunger")) {
    const extra = Math.ceil(
      (WARNING_THRESHOLD - profileAfterEating.satiety) / EATING_SATIETY_RECOVERY_PER_SECOND
    );
    profileAfterEating = settleEating(profileAfterEating, Math.max(0, extra));
  }

  const toIdle = transition(input.fsm, "idle", { completeNatural: true });
  if (!toIdle.ok) {
    throw new Error(`need-interrupt-flow: eating→idle failed: ${toIdle.reason}`);
  }

  const claimAfterResume = claimWork(input.workRegistry, input.workId, input.pawnId);
  return { kind: "ok", profileAfterEating, claimAfterResume };
}

/** 构造评分上下文：`candidateWorks` 仅含当前工单，地图假设食物可达。 */
export function defaultNeedInterruptScoringContext(
  pawnId: string,
  profile: NeedSnapshot,
  currentWork: WorkOrder
): BehaviorContext {
  return {
    pawnId,
    behaviorState: "working",
    needState: { satiety: profile.satiety, energy: profile.energy },
    candidateWorks: [{ ...currentWork, status: "open" }],
    time: { currentPeriod: "day", minuteOfDay: 12 * 60 },
    map: { foodReachable: true, bedReachable: true, reachableCellCount: 1 }
  };
}
