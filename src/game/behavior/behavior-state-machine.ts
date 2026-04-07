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
 * 主状态为 `working` / `eating` / `resting` 时的子状态锚点，与 `oh-gen-doc/行为系统.yaml` 中
 * 「执行工作状态」子状态（伐木/建造/拾取/放置）及「满足需求状态」子状态（进食中/休息中）对齐。
 * 其余主状态下应为 `undefined`（由 `transition` 在离开上述三态时清空）。
 */
export type BehaviorSubState =
  | "chopping"
  | "building"
  | "pickup"
  | "place"
  | "eatingMeal"
  | "sleeping";

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

function buildAllowedTargetsFromEdges(
  edges: readonly BehaviorTransition[]
): Readonly<Record<BehaviorState, readonly BehaviorState[]>> {
  const acc: Record<BehaviorState, BehaviorState[]> = {
    idle: [],
    moving: [],
    working: [],
    eating: [],
    resting: [],
    wandering: []
  };
  for (const e of edges) {
    acc[e.from].push(e.to);
  }
  const states: readonly BehaviorState[] = [
    "idle",
    "moving",
    "working",
    "eating",
    "resting",
    "wandering"
  ];
  const out: Record<BehaviorState, readonly BehaviorState[]> = { ...acc };
  for (const s of states) {
    const uniq = [...new Set(acc[s])].sort((a, b) => a.localeCompare(b));
    out[s] = uniq;
  }
  return out;
}

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
 *
 * 由 `DEFAULT_BEHAVIOR_TRANSITIONS` 聚合生成：**运行时真源仅为该边列表对应的邻接关系**；
 * 本表不得手写独立维护，避免与文档用边枚举漂移。
 */

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
  /** 工作/进食/休息下的策划子状态；状态转移成功后默认清空，由协调层按需 `setBehaviorSubState` 写入。 */
  subState?: BehaviorSubState;
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

/** 浅拷贝 FSM 快照，供重放/分支探索或配合 `transition` 使用（`transition` 会原地修改传入对象）。 */
export function cloneBehaviorFSM(fsm: BehaviorFSM): BehaviorFSM {
  const copy: BehaviorFSM = { pawnId: fsm.pawnId, currentState: fsm.currentState };
  if (fsm.subState !== undefined) {
    copy.subState = fsm.subState;
  }
  if (fsm.lockedUntilInterruptPriority !== undefined) {
    copy.lockedUntilInterruptPriority = fsm.lockedUntilInterruptPriority;
  }
  return copy;
}

/** 由行为执行协调层在 `transition` 之后写入，表达当前工作/需求执行的子阶段。 */
export function setBehaviorSubState(fsm: BehaviorFSM, subState: BehaviorSubState | undefined): void {
  fsm.subState = subState;
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

/**
 * 原地转移：成功时修改 `fsm.currentState`、清空 `subState` 与锁。
 * 若需保留调用前快照（重放、事件日志、并行分支），请使用 `transitionImmutable` 或先 `cloneBehaviorFSM` 再调用本函数。
 */
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
  fsm.subState = undefined;
  fsm.lockedUntilInterruptPriority = undefined;
  return { ok: true, previousState };
}

/**
 * 在克隆上执行与 `transition` 相同的校验与结果语义；**不修改**入参 `fsm`。
 * `next` 为克隆体：成功时含新状态（含 `subState` 清空规则与原地 `transition` 一致），失败时与 `cloneBehaviorFSM(fsm)` 等价。
 */
export function transitionImmutable(
  fsm: BehaviorFSM,
  targetState: BehaviorState,
  context: TransitionContext = {}
): Readonly<{ next: BehaviorFSM; result: TransitionResult }> {
  const next = cloneBehaviorFSM(fsm);
  const result = transition(next, targetState, context);
  return { next, result };
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

/**
 * 行为合法有向边的**唯一数据源**（含策划/文档用 condition、interruptPriority 等示意字段）。
 * `ALLOWED_TARGETS` 由此聚合；新增或删除合法边只改本数组。
 */
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

const ALLOWED_TARGETS: Readonly<Record<BehaviorState, readonly BehaviorState[]>> =
  buildAllowedTargetsFromEdges(DEFAULT_BEHAVIOR_TRANSITIONS);
