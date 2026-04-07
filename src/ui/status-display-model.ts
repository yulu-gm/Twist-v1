/**
 * HUD 状态展示读模型：聚合领域只读字段，无 DOM。
 */

import type { GoalKind } from "../game/behavior/goal-driven-planning";
import { formatTimeOfDayLabel, type WorldTimeSnapshot } from "../game/time";
import type { PawnState } from "../game/pawn-state";
import type { WorkRegistry } from "../game/work/work-registry";
import type {
  WorkItemKind,
  WorkItemSnapshot,
  WorkOrderStatus
} from "../game/work/work-types";

const WORK_ITEM_KIND_TO_BEHAVIOR_ZH: Readonly<Record<WorkItemKind, string>> = {
  "chop-tree": "伐木中",
  "mine-stone": "开采中",
  "pick-up-resource": "拾取物资",
  "haul-to-zone": "搬运物资",
  "construct-blueprint": "建造中",
  "deconstruct-obstacle": "拆除中"
};

function goalKindToBehaviorZh(kind: GoalKind): string {
  switch (kind) {
    case "eat":
      return "进食中";
    case "sleep":
      return "休息中";
    case "wander":
      return "空闲";
    case "recreate":
      return "娱乐中";
  }
}

/**
 * 小人详情面板「当前行为」中文标签：优先 activeWorkItemId 对应工单 kind，否则 currentGoal。
 */
export function pawnDetailBehaviorLabelZh(
  pawn: PawnState,
  workItems: ReadonlyMap<string, WorkItemSnapshot> | undefined
): string {
  const wid = pawn.activeWorkItemId;
  if (wid !== undefined && workItems !== undefined) {
    const item = workItems.get(wid);
    if (item !== undefined) {
      return WORK_ITEM_KIND_TO_BEHAVIOR_ZH[item.kind];
    }
  }
  const goalKind = pawn.currentGoal?.kind;
  if (goalKind !== undefined) return goalKindToBehaviorZh(goalKind);
  return "空闲";
}

/** 用于聚合的最小棋子视图（避免 UI 直接依赖完整 PawnState）。 */
export type PawnStatusDisplayInput = Readonly<{
  pawnId: string;
  name: string;
  behaviorLabel: string;
  /** 饱和度 0–1；若传入大于 1 的值将按条柱封顶处理。 */
  satiety: number;
  /** 精力 0–1；若传入大于 1 的值将按条柱封顶处理。 */
  energy: number;
}>;

export interface PawnStatusDisplay {
  readonly pawnId: string;
  readonly name: string;
  readonly behaviorLabel: string;
  readonly needBars: Readonly<{
    satiety01: number;
    energy01: number;
  }>;
}

export interface TimeStatusDisplay {
  readonly dayNumber: number;
  readonly timeLabel: string;
  readonly period: WorldTimeSnapshot["currentPeriod"];
  readonly speed: WorldTimeSnapshot["speed"];
}

export interface WorkStatusDisplay {
  /** 登记在册的工作单总数（各 status 含 failed）。 */
  readonly totalWork: number;
  /** 仍待处理：`open` + `claimed`。 */
  readonly activeWork: number;
  /** `completed` 数量。 */
  readonly completedWork: number;
}

export interface DashboardDisplay {
  readonly pawns: readonly PawnStatusDisplay[];
  readonly time: TimeStatusDisplay;
  readonly work: WorkStatusDisplay;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function pawnRow(input: PawnStatusDisplayInput): PawnStatusDisplay {
  return {
    pawnId: input.pawnId,
    name: input.name,
    behaviorLabel: input.behaviorLabel,
    needBars: {
      satiety01: clamp01(input.satiety),
      energy01: clamp01(input.energy)
    }
  };
}

function timeRow(time: WorldTimeSnapshot): TimeStatusDisplay {
  return {
    dayNumber: time.dayNumber,
    timeLabel: formatTimeOfDayLabel({
      dayNumber: time.dayNumber,
      minuteOfDay: time.minuteOfDay
    }),
    period: time.currentPeriod,
    speed: time.speed
  };
}

const STATUS_COUNT_KEYS: readonly WorkOrderStatus[] = [
  "open",
  "claimed",
  "completed",
  "failed"
];

function workDisplayFromRegistry(registry: WorkRegistry): WorkStatusDisplay {
  const counts: Record<WorkOrderStatus, number> = {
    open: 0,
    claimed: 0,
    completed: 0,
    failed: 0
  };
  for (const o of registry.orders.values()) {
    counts[o.status]++;
  }
  const totalWork = STATUS_COUNT_KEYS.reduce((s, k) => s + counts[k], 0);
  return {
    totalWork,
    activeWork: counts.open + counts.claimed,
    completedWork: counts.completed
  };
}

export function aggregateStatusDisplay(
  pawns: readonly PawnStatusDisplayInput[],
  time: WorldTimeSnapshot,
  workRegistry: WorkRegistry
): DashboardDisplay {
  return {
    pawns: pawns.map(pawnRow),
    time: timeRow(time),
    work: workDisplayFromRegistry(workRegistry)
  };
}
