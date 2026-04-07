/**
 * 需求紧迫度 → UI/行为可读信号。阈值与 {@link PAWN_NEED_URGENCY_RULES} / sim-loop 走向工单中断一致；
 * 若传入 `satiety`/`energy` 则经 {@link pawnNeedsFromScalars} 推导紧急度，与 legacy `PawnNeeds` 双写解耦。
 */

import type { PawnNeeds } from "../pawn-state";
import { pawnNeedsFromScalars } from "./need-utils";
import {
  HUNGER_INTERRUPT_THRESHOLD,
  PAWN_NEEDS_HUNGER_WARN,
  PAWN_NEEDS_REST_WARN,
  REST_INTERRUPT_THRESHOLD
} from "./threshold-rules";

/** 若同时给出 `satiety`/`energy`，饥饿与疲劳紧迫度由此推导，与 `needs.hunger`/`needs.rest` 双写脱钩。 */
export type NeedSignalsInput = PawnNeeds & {
  satiety?: number;
  energy?: number;
};

export type NeedUrgency = "ok" | "warn" | "critical";

export type NeedSignalSnapshot = Readonly<{
  hungerUrgency: NeedUrgency;
  restUrgency: NeedUrgency;
  /** 与 `rest` 共用警戒/紧急区间（见 `PAWN_NEEDS_REST_WARN` 与 `REST_INTERRUPT_THRESHOLD`）。 */
  recreationUrgency: NeedUrgency;
  /** 疲劳高于 `REST_INTERRUPT_THRESHOLD` 时与 sim-loop 走向工单中断对齐，建议允许打断。 */
  allowInterruptWorkForRest: boolean;
  /** 饥饿高于 `HUNGER_INTERRUPT_THRESHOLD` 时与 sim-loop 对齐。 */
  allowInterruptWorkForHunger: boolean;
  /** 娱乐高于 `REST_INTERRUPT_THRESHOLD` 时对齐。 */
  allowInterruptWorkForRecreation: boolean;
  summaryLine: string;
}>;

export function needSignalsFromNeeds(input: NeedSignalsInput): NeedSignalSnapshot {
  const recreation = input.recreation;
  const derived =
    input.satiety !== undefined && input.energy !== undefined
      ? pawnNeedsFromScalars(input.satiety, input.energy, recreation)
      : null;
  const hunger = derived?.hunger ?? input.hunger;
  const rest = derived?.rest ?? input.rest;

  const hungerUrgency: NeedUrgency =
    hunger > HUNGER_INTERRUPT_THRESHOLD
      ? "critical"
      : hunger >= PAWN_NEEDS_HUNGER_WARN
        ? "warn"
        : "ok";
  const restUrgency: NeedUrgency =
    rest > REST_INTERRUPT_THRESHOLD
      ? "critical"
      : rest >= PAWN_NEEDS_REST_WARN
        ? "warn"
        : "ok";
  const recreationUrgency: NeedUrgency =
    recreation > REST_INTERRUPT_THRESHOLD
      ? "critical"
      : recreation >= PAWN_NEEDS_REST_WARN
        ? "warn"
        : "ok";

  const allowInterruptWorkForHunger = hunger > HUNGER_INTERRUPT_THRESHOLD;
  const allowInterruptWorkForRest = rest > REST_INTERRUPT_THRESHOLD;
  const allowInterruptWorkForRecreation = recreation > REST_INTERRUPT_THRESHOLD;

  const parts: string[] = [];
  if (hungerUrgency !== "ok") parts.push(`饥饿 ${hungerUrgency}`);
  if (restUrgency !== "ok") parts.push(`疲劳 ${restUrgency}`);
  if (recreationUrgency !== "ok") parts.push(`娱乐 ${recreationUrgency}`);

  return {
    hungerUrgency,
    restUrgency,
    recreationUrgency,
    allowInterruptWorkForRest,
    allowInterruptWorkForHunger,
    allowInterruptWorkForRecreation,
    summaryLine: parts.length ? parts.join(" · ") : "需求稳定"
  };
}
