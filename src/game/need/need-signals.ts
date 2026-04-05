/**
 * B-M2 前置：需求压力 → 行为编排可读信号（与 pawn-state 数值解耦的薄映射）。
 * 不涉及路径与选目标，仅供 UI/行为层展示与后续评分器消费。
 */

import type { PawnNeeds } from "../pawn-state";

export type NeedUrgency = "ok" | "warn" | "critical";

export type NeedSignalSnapshot = Readonly<{
  hungerUrgency: NeedUrgency;
  restUrgency: NeedUrgency;
  /** 若疲劳紧急，建议允许打断当前工作（mock：阈值 75）。 */
  allowInterruptWorkForRest: boolean;
  /** 若饥饿紧急，建议允许打断当前工作（mock：阈值 80）。 */
  allowInterruptWorkForHunger: boolean;
  summaryLine: string;
}>;

const HUNGER_CRITICAL = 80;
const HUNGER_WARN = 55;
const REST_CRITICAL = 75;
const REST_WARN = 50;

export function needSignalsFromNeeds(needs: PawnNeeds): NeedSignalSnapshot {
  const hungerUrgency: NeedUrgency =
    needs.hunger >= HUNGER_CRITICAL ? "critical" : needs.hunger >= HUNGER_WARN ? "warn" : "ok";
  const restUrgency: NeedUrgency =
    needs.rest >= REST_CRITICAL ? "critical" : needs.rest >= REST_WARN ? "warn" : "ok";

  const allowInterruptWorkForHunger = needs.hunger >= HUNGER_CRITICAL;
  const allowInterruptWorkForRest = needs.rest >= REST_CRITICAL;

  const parts: string[] = [];
  if (hungerUrgency !== "ok") parts.push(`饥饿 ${hungerUrgency}`);
  if (restUrgency !== "ok") parts.push(`疲劳 ${restUrgency}`);

  return {
    hungerUrgency,
    restUrgency,
    allowInterruptWorkForRest,
    allowInterruptWorkForHunger,
    summaryLine: parts.length ? parts.join(" · ") : "需求稳定"
  };
}
