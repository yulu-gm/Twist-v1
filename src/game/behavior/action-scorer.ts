import type { BehaviorContext } from "./behavior-context";
import type { GridCoord } from "../map/world-grid";
import type { TimePeriod } from "../time/world-time";

/** 评分器输出的候选行动类型（与状态机 `BehaviorState` 意图对齐，不含 moving）。 */
export type ActionKind = "eat" | "rest" | "work" | "wander";

export type ActionCandidate = Readonly<{
  kind: ActionKind;
  /** 工单的 `workId`，或 eat/rest 解析到的实体 id；非必有。 */
  targetId?: string;
  score: number;
  reason: string;
}>;

/** 需求紧急度权重：饥饿/疲劳越接近 0，对应吃/休分数越高。 */
const NEED_URGENCY_WEIGHT = 12;

/** 工作在「需求尚可」时的增益；与工单 `priority` 相乘。 */
const WORK_PRIORITY_WEIGHT = 6;

/** 散步基准分，始终低于正常 Needs 与典型工作组合。 */
const WANDER_BASE_SCORE = 18;

/** 曼哈顿距离衰减系数：得分乘 `1 / (1 + k * dist)`。 */
const WORK_DISTANCE_DECAY_K = 0.07;

/** 与 `WorldTimeSnapshot.currentPeriod` 一致：夜间提高休息倾向、压低工作与闲逛。 */
const TIME_REST_MULT: Readonly<Record<TimePeriod, number>> = { day: 1, night: 1.32 };
const TIME_WORK_MULT: Readonly<Record<TimePeriod, number>> = { day: 1, night: 0.9 };
const TIME_WANDER_MULT: Readonly<Record<TimePeriod, number>> = { day: 1, night: 0.68 };

/**
 * 综合舒适度：两需求取较小值（木桶效应），归一到 0–1。
 * satiety/energy 越低 → 因子越小 → {@link workScoreFromContext} 的工作分越低；
 * 同时 eat/rest 的紧急分项变高。
 */
function needComfort01(satiety: number, energy: number): number {
  const lo = Math.min(satiety, energy);
  return Math.max(0, Math.min(1, lo / 100));
}

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/** 无 `pawnCell` 时视为不施加距离项（由调度器预过滤时可不传）。 */
function workDistanceFactor(pawnCell: GridCoord | undefined, targetCell: GridCoord): number {
  if (!pawnCell) return 1;
  const d = manhattan(pawnCell, targetCell);
  return 1 / (1 + WORK_DISTANCE_DECAY_K * d);
}

function periodForContext(context: BehaviorContext): TimePeriod {
  return context.time.currentPeriod;
}

/**
 * 摘要中的 food/bed 标志与 `mapCellQuery` 谓词形态配套使用：
 * 谓词由聚合器透传时 `map` 可能为保守默认值，此时仍应允许需求紧急分参与评分。
 */
function needSiteReachable(mapFlag: boolean, context: BehaviorContext): boolean {
  return mapFlag || context.mapCellQuery !== undefined;
}

function eatUrgencyScore(context: BehaviorContext): number {
  if (!needSiteReachable(context.map.foodReachable, context)) return 0;
  const deficit = Math.max(0, 100 - context.needState.satiety);
  return deficit * NEED_URGENCY_WEIGHT;
}

function restUrgencyScore(context: BehaviorContext): number {
  if (!needSiteReachable(context.map.bedReachable, context)) return 0;
  const deficit = Math.max(0, 100 - context.needState.energy);
  return deficit * NEED_URGENCY_WEIGHT;
}

function workScoreFromContext(context: BehaviorContext): ActionCandidate[] {
  const comfort = needComfort01(context.needState.satiety, context.needState.energy);
  const period = periodForContext(context);
  const timeM = TIME_WORK_MULT[period];
  const pawnCell = context.pawnCell;
  const out: ActionCandidate[] = [];
  for (const w of context.candidateWorks) {
    const distF = workDistanceFactor(pawnCell, w.targetCell);
    const raw = w.priority * comfort * WORK_PRIORITY_WEIGHT * distF * timeM;
    const score = Math.round(raw * 10) / 10;
    out.push({
      kind: "work",
      targetId: w.workId,
      score,
      reason: `work:${w.kind}:pri=${w.priority}:comfort=${comfort.toFixed(2)}:dist=${distF.toFixed(3)}:period=${period}`
    });
  }
  return out;
}

/**
 * 可替换的行动评分策略（如性格/职业差异化规则）。默认实现见 {@link DEFAULT_ACTION_SCORING_STRATEGY}。
 */
export type ActionScoringStrategy = Readonly<{
  scoreActions(context: BehaviorContext): ActionCandidate[];
}>;

/**
 * 当前仓库默认评分：需求紧急度 > 工作（priority、舒适度、距离衰减、时段）> 散步；时段对 rest/work/wander 与 `TimePeriod` 对齐。
 */
function scoreActionsDefaultImpl(context: BehaviorContext): ActionCandidate[] {
  const withIndex: Array<{ c: ActionCandidate; i: number }> = [];
  const period = periodForContext(context);

  const eatScore = eatUrgencyScore(context);
  if (eatScore > 0) {
    const foodId = context.map.foodTargetId;
    withIndex.push({
      c: {
        kind: "eat",
        ...(foodId !== undefined && foodId !== "" ? { targetId: foodId } : {}),
        score: Math.round(eatScore * 10) / 10,
        reason: `eat:urgency=satiety-deficit×${NEED_URGENCY_WEIGHT}:period=${period}`
      },
      i: withIndex.length
    });
  }

  const restScore = restUrgencyScore(context);
  if (restScore > 0) {
    const bedId = context.map.bedTargetId;
    const restScaled = restScore * TIME_REST_MULT[period];
    withIndex.push({
      c: {
        kind: "rest",
        ...(bedId !== undefined && bedId !== "" ? { targetId: bedId } : {}),
        score: Math.round(restScaled * 10) / 10,
        reason: `rest:urgency=energy-deficit×${NEED_URGENCY_WEIGHT}×timeRest(${TIME_REST_MULT[period]}):period=${period}`
      },
      i: withIndex.length
    });
  }

  for (const w of workScoreFromContext(context)) {
    withIndex.push({ c: w, i: withIndex.length });
  }

  const wanderRaw = WANDER_BASE_SCORE * TIME_WANDER_MULT[period];
  withIndex.push({
    c: {
      kind: "wander",
      score: Math.round(wanderRaw * 10) / 10,
      reason: `wander:base=${WANDER_BASE_SCORE}×timeWander(${TIME_WANDER_MULT[period]}):period=${period}`
    },
    i: withIndex.length
  });

  withIndex.sort((a, b) => {
    const byScore = b.c.score - a.c.score;
    if (byScore !== 0) return byScore;
    return a.i - b.i;
  });

  return withIndex.map((x) => x.c);
}

/** 与历史 `scoreActions(context)` 行为一致的默认策略，便于 A/B 或性格/职业扩展时替换。 */
export const DEFAULT_ACTION_SCORING_STRATEGY: ActionScoringStrategy = {
  scoreActions: scoreActionsDefaultImpl
};

/**
 * 根据上下文生成候选行动并按分数**降序**稳定排序。
 * 未传入 `strategy` 时使用 {@link DEFAULT_ACTION_SCORING_STRATEGY}。
 */
export function scoreActions(
  context: BehaviorContext,
  strategy: ActionScoringStrategy = DEFAULT_ACTION_SCORING_STRATEGY
): ActionCandidate[] {
  return strategy.scoreActions(context);
}
