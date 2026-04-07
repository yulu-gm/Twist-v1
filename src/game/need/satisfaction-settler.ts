/**
 * 需求满足结算器：按**整段时长**结算进食/休息增量，速率与 {@link evolveNeeds} 中 `eating`/`resting` 一致。
 *
 * **禁止双重结算**：主循环已在 `tickSimulation` 阶段 1 用 `advancePawnNeedsWithBehavior` → `evolveNeeds`
 * 按秒推进时，不得再对**同一仿真时段**调用 `settleEating` / `settleResting`；本模块适用于未走 tick
 * 演化的区间（场景合成、测试、中断部分恢复等）。
 */
import {
  EATING_SATIETY_RECOVERY_PER_SECOND,
  RESTING_ENERGY_RECOVERY_PER_SECOND
} from "./need-evolution-engine";
import {
  type NeedSnapshot,
  updateNeedProfile
} from "./need-profile";
import { WARNING_THRESHOLD } from "./threshold-rules";

export type SatisfiableNeedKind = "hunger" | "fatigue";

/**
 * 用于 {@link settleInterrupted}：假设“本段进食/休息若未被中断”会持续的标准秒数；
 * 部分恢复量为该段满额增量的 50%。
 */
export const PARTIAL_INTERRUPT_REFERENCE_SECONDS = 5;

/** 按秒结算进食带来的饱食度上升。 */
export function settleEating(
  profile: NeedSnapshot,
  durationSeconds: number
): NeedSnapshot {
  const dt = Math.max(0, durationSeconds);
  return updateNeedProfile(
    profile,
    EATING_SATIETY_RECOVERY_PER_SECOND * dt,
    0
  );
}

/** 按秒结算休息带来的精力上升。 */
export function settleResting(
  profile: NeedSnapshot,
  durationSeconds: number
): NeedSnapshot {
  const dt = Math.max(0, durationSeconds);
  return updateNeedProfile(profile, 0, RESTING_ENERGY_RECOVERY_PER_SECOND * dt);
}

/** `hunger` / `fatigue` 是否在安全水平及以上（≥ {@link WARNING_THRESHOLD}）。 */
export function isNeedSatisfied(
  profile: NeedSnapshot,
  needKind: SatisfiableNeedKind
): boolean {
  if (needKind === "hunger") {
    return profile.satiety >= WARNING_THRESHOLD;
  }
  return profile.energy >= WARNING_THRESHOLD;
}

/**
 * 行为被中断时的部分恢复：为“参考持续时长”下满额增量的一半（另一半视为浪费）。
 */
export function settleInterrupted(
  profile: NeedSnapshot,
  needKind: SatisfiableNeedKind
): NeedSnapshot {
  const ref = PARTIAL_INTERRUPT_REFERENCE_SECONDS;
  const half = 0.5;
  if (needKind === "hunger") {
    const delta =
      half * EATING_SATIETY_RECOVERY_PER_SECOND * ref;
    return updateNeedProfile(profile, delta, 0);
  }
  const delta = half * RESTING_ENERGY_RECOVERY_PER_SECOND * ref;
  return updateNeedProfile(profile, 0, delta);
}
