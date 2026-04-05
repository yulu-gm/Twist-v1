/** 饱食度 / 精力阈值与阶段评估（数值越高越好，低于阈值逐级变糟）。 */

export type NeedStage = "normal" | "warning" | "critical";

export const WARNING_THRESHOLD = 40;
export const CRITICAL_THRESHOLD = 20;

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
