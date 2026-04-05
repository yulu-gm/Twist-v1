import type { PawnId } from "../pawn-state";

/**
 * 小人行为主状态（与 goal-driven-planning 的 GoalKind / 执行阶段解耦，仅表达 FSM 层语义）。
 */
export type BehaviorState =
  | "idle"
  | "moving"
  | "working"
  | "eating"
  | "resting"
  | "wandering";

/**
 * 单条转换规则（用于文档化与枚举；运行时使用邻接表）。
 *
 * - `condition`：触发说明或谓词标签（如 `goal-chosen`、`path-complete`、`need-interrupt`）。
 * - `interruptPriority`：本条转换若作为**打断方**参与排序时的参考优先级（数值越大越能抢占他人）。
 */
export type BehaviorTransition = Readonly<{
  from: BehaviorState;
  to: BehaviorState;
  condition: string;
  predicateHint?: string;
  interruptPriority: number;
}>;

/**
 * 邻接表定义的**合法有向边**（不含自环）：
 *
 * - **idle** → moving | working | eating | resting | wandering
 * - **moving** → idle | working | eating | resting | wandering
 * - **working** → idle | moving | eating | resting | wandering
 * - **eating** → idle | moving | working | resting | wandering
 * - **resting** → idle | moving | working | eating | wandering
 * - **wandering** → idle | moving | working | eating | resting
 *
 * 不在上表中的边（含任意状态 → 自身）均为非法。
 */
const ALLOWED_TARGETS: Readonly<Record<BehaviorState, readonly BehaviorState[]>> = {
  idle: ["moving", "working", "eating", "resting", "wandering"],
  moving: ["idle", "working", "eating", "resting", "wandering"],
  working: ["idle", "moving", "eating", "resting", "wandering"],
  eating: ["idle", "moving", "working", "resting", "wandering"],
  resting: ["idle", "moving", "working", "eating", "wandering"],
  wandering: ["idle", "moving", "working", "eating", "resting"]
};

/** 各状态要打断当前活动所需的最低打断优先级（越大越难打断；idle 视为无活动）。 */
const MIN_INTERRUPT_PRIORITY_TO_BREAK: Readonly<Record<BehaviorState, number>> = {
  idle: 0,
  wandering: 10,
  moving: 25,
  resting: 35,
  eating: 40,
  working: 55
};

export type BehaviorFSM = {
  pawnId: PawnId;
  currentState: BehaviorState;
  /**
   * 若设置：`transition` 在变更状态前要求 `context.interruptPriority >= 该值`（自然完成流须传足够高的优先级或先清锁）。
   * 成功转移后由本模块清空，除非调用方再次设置。
   */
  lockedUntilInterruptPriority?: number;
};

export type TransitionContext = Readonly<{
  /**
   * 当存在 `lockedUntilInterruptPriority` 且非 `completeNatural` 时必须 ≥ 锁，
   * 否则 `transition` 返回 `below-lock-priority`。
   */
  interruptPriority?: number;
  /** 活动正常结束（如工作做完），不应用锁拦截。 */
  completeNatural?: boolean;
}>;

export type TransitionFailureReason =
  | "already-in-state"
  | "illegal-transition"
  | "below-lock-priority";

export type TransitionResult =
  | Readonly<{ ok: true; previousState: BehaviorState }>
  | Readonly<{ ok: false; reason: TransitionFailureReason }>;

export function createBehaviorFSM(pawnId: PawnId): BehaviorFSM {
  return { pawnId, currentState: "idle" };
}

export function getCurrentState(fsm: BehaviorFSM): BehaviorState {
  return fsm.currentState;
}

export function canTransition(fsm: BehaviorFSM, targetState: BehaviorState): boolean {
  if (targetState === fsm.currentState) {
    return false;
  }
  const allowed = ALLOWED_TARGETS[fsm.currentState];
  return allowed.includes(targetState);
}

export function transition(
  fsm: BehaviorFSM,
  targetState: BehaviorState,
  context: TransitionContext = {}
): TransitionResult {
  if (targetState === fsm.currentState) {
    return { ok: false, reason: "already-in-state" };
  }
  if (!canTransition(fsm, targetState)) {
    return { ok: false, reason: "illegal-transition" };
  }

  const lock = fsm.lockedUntilInterruptPriority;
  if (lock !== undefined && !context.completeNatural) {
    const p = context.interruptPriority ?? Number.NEGATIVE_INFINITY;
    if (p < lock) {
      return { ok: false, reason: "below-lock-priority" };
    }
  }

  const previousState = fsm.currentState;
  fsm.currentState = targetState;
  fsm.lockedUntilInterruptPriority = undefined;
  return { ok: true, previousState };
}

/**
 * 当前状态是否可被「优先级 ≥ 阈值的打断请求」抢占：
 * 当且仅当 `interruptPriority >= max(状态基础阈值, lockedUntilInterruptPriority ?? 0)`。
 *
 * idle 的基础阈值为 0，故任意非负优先级均可视为可打断（idle 本身无占用）。
 */
export function canBeInterrupted(fsm: BehaviorFSM, interruptPriority: number): boolean {
  const base = MIN_INTERRUPT_PRIORITY_TO_BREAK[fsm.currentState];
  const lock = fsm.lockedUntilInterruptPriority ?? 0;
  const threshold = Math.max(base, lock);
  return interruptPriority >= threshold;
}

/** 策划/文档用：枚举默认规则边（与 ALLOWED_TARGETS 一致，condition / priority 为示意）。 */
export const DEFAULT_BEHAVIOR_TRANSITIONS: readonly BehaviorTransition[] = [
  {
    from: "idle",
    to: "moving",
    condition: "path-assigned",
    predicateHint: "has-destination",
    interruptPriority: 20
  },
  {
    from: "idle",
    to: "working",
    condition: "work-assigned",
    interruptPriority: 30
  },
  {
    from: "idle",
    to: "eating",
    condition: "eat-started-at-point",
    interruptPriority: 35
  },
  {
    from: "idle",
    to: "resting",
    condition: "rest-started-at-point",
    interruptPriority: 35
  },
  {
    from: "idle",
    to: "wandering",
    condition: "wander-chosen",
    interruptPriority: 5
  },
  {
    from: "moving",
    to: "idle",
    condition: "halt-or-arrived",
    predicateHint: "path-complete",
    interruptPriority: 15
  },
  {
    from: "moving",
    to: "working",
    condition: "arrived-at-job-site",
    interruptPriority: 45
  },
  {
    from: "moving",
    to: "eating",
    condition: "arrived-at-food",
    interruptPriority: 40
  },
  {
    from: "moving",
    to: "resting",
    condition: "arrived-at-bed",
    interruptPriority: 38
  },
  {
    from: "moving",
    to: "wandering",
    condition: "reroute-wander",
    interruptPriority: 12
  },
  {
    from: "working",
    to: "idle",
    condition: "job-finished-or-cancelled",
    interruptPriority: 50
  },
  {
    from: "working",
    to: "moving",
    condition: "job-reposition",
    interruptPriority: 48
  },
  {
    from: "working",
    to: "eating",
    condition: "need-interrupt-hunger",
    interruptPriority: 70
  },
  {
    from: "working",
    to: "resting",
    condition: "need-interrupt-rest",
    interruptPriority: 65
  },
  {
    from: "working",
    to: "wandering",
    condition: "abandon-to-wander",
    interruptPriority: 20
  },
  {
    from: "eating",
    to: "idle",
    condition: "meal-complete",
    interruptPriority: 30
  },
  {
    from: "eating",
    to: "moving",
    condition: "leave-dining",
    interruptPriority: 35
  },
  {
    from: "eating",
    to: "working",
    condition: "resume-work",
    interruptPriority: 50
  },
  {
    from: "eating",
    to: "resting",
    condition: "switch-to-rest",
    interruptPriority: 42
  },
  {
    from: "eating",
    to: "wandering",
    condition: "abandon-meal-wander",
    interruptPriority: 15
  },
  {
    from: "resting",
    to: "idle",
    condition: "wake",
    interruptPriority: 28
  },
  {
    from: "resting",
    to: "moving",
    condition: "leave-bed",
    interruptPriority: 32
  },
  {
    from: "resting",
    to: "working",
    condition: "day-start-work",
    interruptPriority: 48
  },
  {
    from: "resting",
    to: "eating",
    condition: "wake-hungry",
    interruptPriority: 44
  },
  {
    from: "resting",
    to: "wandering",
    condition: "wake-wander",
    interruptPriority: 12
  },
  {
    from: "wandering",
    to: "idle",
    condition: "wander-stop",
    interruptPriority: 8
  },
  {
    from: "wandering",
    to: "moving",
    condition: "wander-to-goal",
    interruptPriority: 18
  },
  {
    from: "wandering",
    to: "working",
    condition: "job-pull-while-wander",
    interruptPriority: 45
  },
  {
    from: "wandering",
    to: "eating",
    condition: "hunger-while-wander",
    interruptPriority: 38
  },
  {
    from: "wandering",
    to: "resting",
    condition: "fatigue-while-wander",
    interruptPriority: 36
  }
] as const;
