import type { BehaviorContext } from "./behavior-context";

/** 评分器输出的候选行动类型（与状态机 `BehaviorState` 意图对齐，不含 moving）。 */
export type ActionKind = "eat" | "rest" | "work" | "wander";

export type ActionCandidate = Readonly<{
  kind: ActionKind;
  /** 工单的 `workId`，非工作候选可省略。 */
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

/**
 * 综合舒适度：两需求取较小值（木桶效应），归一到 0–1。
 * satiety/energy 越低 → 因子越小 → {@link workScoreFromContext} 的工作分越低；
 * 同时 eat/rest 的紧急分项变高。
 */
function needComfort01(satiety: number, energy: number): number {
  const lo = Math.min(satiety, energy);
  return Math.max(0, Math.min(1, lo / 100));
}

function eatUrgencyScore(context: BehaviorContext): number {
  if (!context.map.foodReachable) return 0;
  const deficit = Math.max(0, 100 - context.needState.satiety);
  return deficit * NEED_URGENCY_WEIGHT;
}

function restUrgencyScore(context: BehaviorContext): number {
  if (!context.map.bedReachable) return 0;
  const deficit = Math.max(0, 100 - context.needState.energy);
  return deficit * NEED_URGENCY_WEIGHT;
}

function workScoreFromContext(context: BehaviorContext): ActionCandidate[] {
  const comfort = needComfort01(context.needState.satiety, context.needState.energy);
  const out: ActionCandidate[] = [];
  for (const w of context.candidateWorks) {
    const raw = w.priority * comfort * WORK_PRIORITY_WEIGHT;
    const score = Math.round(raw * 10) / 10;
    out.push({
      kind: "work",
      targetId: w.workId,
      score,
      reason: `work:${w.kind}:pri=${w.priority}:comfort=${comfort.toFixed(2)}`
    });
  }
  return out;
}

/**
 * 根据上下文生成候选行动并按分数**降序**稳定排序。
 * 规则层级：需求紧急度 > 工作（随 priority 与需求舒适度）> 散步。
 */
export function scoreActions(context: BehaviorContext): ActionCandidate[] {
  const withIndex: Array<{ c: ActionCandidate; i: number }> = [];

  const eatScore = eatUrgencyScore(context);
  if (eatScore > 0) {
    withIndex.push({
      c: {
        kind: "eat",
        score: Math.round(eatScore * 10) / 10,
        reason: `eat:urgency=satiety-deficit×${NEED_URGENCY_WEIGHT}`
      },
      i: withIndex.length
    });
  }

  const restScore = restUrgencyScore(context);
  if (restScore > 0) {
    withIndex.push({
      c: {
        kind: "rest",
        score: Math.round(restScore * 10) / 10,
        reason: `rest:urgency=energy-deficit×${NEED_URGENCY_WEIGHT}`
      },
      i: withIndex.length
    });
  }

  for (const w of workScoreFromContext(context)) {
    withIndex.push({ c: w, i: withIndex.length });
  }

  withIndex.push({
    c: {
      kind: "wander",
      score: WANDER_BASE_SCORE,
      reason: `wander:base=${WANDER_BASE_SCORE}`
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
