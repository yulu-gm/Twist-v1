/** 饱食度 / 精力阈值与阶段评估（数值越高越好，低于阈值逐级变糟）。 */

export type NeedStage = "normal" | "warning" | "critical";

export const WARNING_THRESHOLD = 40;
export const CRITICAL_THRESHOLD = 20;

/**
 * PawnNeeds 量纲为越高越紧迫：警戒 / 走向工单中断与 UI 信号共用此表（`oh-code-design/需求系统.yaml`「需求规则配置」）。
 */
export const PAWN_NEED_URGENCY_RULES = {
  hunger: { warn: 55, interruptWalkWork: 70 },
  rest: { warn: 50, interruptWalkWork: 70 },
  recreation: { warn: 50, interruptWalkWork: 70 }
} as const;

/** sim-loop：饥饿需求值超过此阈值时，放弃已认领的走向工单（与 `PAWN_NEED_URGENCY_RULES.hunger.interruptWalkWork` 同源）。 */
export const HUNGER_INTERRUPT_THRESHOLD = PAWN_NEED_URGENCY_RULES.hunger.interruptWalkWork;

/** sim-loop：疲劳对称；与 `PAWN_NEED_URGENCY_RULES.rest.interruptWalkWork` 同源。 */
export const REST_INTERRUPT_THRESHOLD = PAWN_NEED_URGENCY_RULES.rest.interruptWalkWork;

/**
 * needs.rest 高于此值视为夜间应优先睡眠（与 needs.rest 量纲一致；与 NEED-002 / Phase 6 对齐）。
 * 用于：日夜边界强制释放走向类工单、夜间睡眠目标得分加权。
 */
export const REST_SLEEP_PRIORITY_THRESHOLD = 50;

/** chooseGoalDecision：夜间且 rest 急迫时，睡眠候选得分乘数。 */
export const NIGHT_SLEEP_GOAL_SCORE_MULTIPLIER = 3;

const STAGE_RANK: Record<NeedStage, number> = {
  normal: 0,
  warning: 1,
  critical: 2
};

function stageUrgency(stage: NeedStage): number {
  switch (stage) {
    case "normal":
      return 0;
    case "warning":
      return 50;
    case "critical":
      return 100;
  }
}

export function evaluateHungerStage(satiety: number): NeedStage {
  if (satiety <= CRITICAL_THRESHOLD) return "critical";
  if (satiety < WARNING_THRESHOLD) return "warning";
  return "normal";
}

export function evaluateFatigueStage(energy: number): NeedStage {
  if (energy <= CRITICAL_THRESHOLD) return "critical";
  if (energy < WARNING_THRESHOLD) return "warning";
  return "normal";
}

export type NeedActionSuggestion = Readonly<{
  actionKind: "eat" | "rest" | "none";
  /** 0..100，越高越紧迫（与当前建议行动或整体压力对齐）。 */
  urgency: number;
  allowInterrupt: boolean;
}>;

export function needActionSuggestion(profile: {
  satiety: number;
  energy: number;
  hungerStage: NeedStage;
  fatigueStage: NeedStage;
}): NeedActionSuggestion {
  const { satiety, energy, hungerStage, fatigueStage } = profile;
  const hungerU = stageUrgency(hungerStage);
  const fatigueU = stageUrgency(fatigueStage);
  const allowInterrupt = hungerStage === "critical" || fatigueStage === "critical";

  if (hungerStage === "normal" && fatigueStage === "normal") {
    return { actionKind: "none", urgency: 0, allowInterrupt: false };
  }

  const hr = STAGE_RANK[hungerStage];
  const fr = STAGE_RANK[fatigueStage];

  if (hr > fr) {
    return { actionKind: "eat", urgency: hungerU, allowInterrupt };
  }
  if (fr > hr) {
    return { actionKind: "rest", urgency: fatigueU, allowInterrupt };
  }

  /** 同级告警时，比较缺口（越低越缺）决定优先吃还是睡。 */
  const deficitFood = 100 - satiety;
  const deficitRest = 100 - energy;
  if (deficitFood > deficitRest) {
    return { actionKind: "eat", urgency: hungerU, allowInterrupt };
  }
  if (deficitRest > deficitFood) {
    return { actionKind: "rest", urgency: fatigueU, allowInterrupt };
  }
  return { actionKind: "eat", urgency: hungerU, allowInterrupt };
}

// ---------------------------------------------------------------------------
// PawnNeeds 紧急度投影（`need-signals.ts`）：与上文 satiety/energy 阶段阈值量纲不同；数值取自 {@link PAWN_NEED_URGENCY_RULES}。

/** 饥饿警戒阈值（含）：映射为 warn。 */
export const PAWN_NEEDS_HUNGER_WARN = PAWN_NEED_URGENCY_RULES.hunger.warn;
/**
 * 饥饿「紧急」刻度，与 {@link HUNGER_INTERRUPT_THRESHOLD} 相同。
 * 与 sim-loop 一致判定为「紧迫」时请用 `need.hunger > HUNGER_INTERRUPT_THRESHOLD`（严格大于）。
 */
export const PAWN_NEEDS_HUNGER_CRITICAL = PAWN_NEED_URGENCY_RULES.hunger.interruptWalkWork;

/** 疲劳警戒阈值（含）；娱乐与疲劳共用 warn 刻度。 */
export const PAWN_NEEDS_REST_WARN = PAWN_NEED_URGENCY_RULES.rest.warn;
/** 疲劳/娱乐紧急刻度，与 {@link REST_INTERRUPT_THRESHOLD} 相同。 */
export const PAWN_NEEDS_REST_CRITICAL = PAWN_NEED_URGENCY_RULES.rest.interruptWalkWork;
