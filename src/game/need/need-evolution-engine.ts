import type { BehaviorState } from "../behavior/behavior-state-machine";
import {
  type NeedSnapshot,
  updateNeedProfile
} from "./need-profile";

/**
 * 单位游戏时间（秒）内饱食度 / 精力变化速率。
 *
 * - **satietyPerSecond**：正值为恢复，负值为消耗（饥饿加剧）。
 * - **energyPerSecond**：正值为恢复，负值为消耗（更累）。
 *
 * 典型配置见 {@link DEFAULT_EVOLUTION_BY_BEHAVIOR}；也可整体替换为自定义表。
 */
export type NeedEvolutionRates = Readonly<{
  satietyPerSecond: number;
  energyPerSecond: number;
}>;

/** 基准“轻度消耗”（idle）：略饿、略累。 */
export const BASE_SATIETY_DRAIN_PER_SECOND = 0.02;
export const BASE_ENERGY_DRAIN_PER_SECOND = 0.015;

/** 相对 idle：工作加快饥饿与疲劳。 */
export const WORKING_SATIETY_MULTIPLIER = 2.5;
export const WORKING_ENERGY_MULTIPLIER = 2;

/** 相对 idle：游荡为中等消耗。 */
export const WANDERING_SATIETY_MULTIPLIER = 1.6;
export const WANDERING_ENERGY_MULTIPLIER = 1.5;

/** 休息时精力净恢复（每秒）。 */
export const RESTING_ENERGY_RECOVERY_PER_SECOND = 0.06;

/** 进食中饱食净恢复（每秒）；与 `satisfaction-settler` 中结算速率一致。 */
export const EATING_SATIETY_RECOVERY_PER_SECOND = 0.12;

function ratesForBehavior(state: BehaviorState): NeedEvolutionRates {
  return DEFAULT_EVOLUTION_BY_BEHAVIOR[state];
}

/**
 * 各 {@link BehaviorState} 默认演化速率（可在外部复制后改写再传入定制逻辑）。
 *
 * - **working**：饥饿衰减明显加快，体力消耗加重。
 * - **resting**：精力回升，仍可能有极轻微代谢性饱食下降。
 * - **wandering**：介于 idle 与工作之间的中等消耗。
 * - **eating**：以饱食恢复为主；不进餐时仍可有轻微精力波动（此处略降，避免与休息混淆）。
 */
export const DEFAULT_EVOLUTION_BY_BEHAVIOR: Readonly<
  Record<BehaviorState, NeedEvolutionRates>
> = {
  idle: {
    satietyPerSecond: -BASE_SATIETY_DRAIN_PER_SECOND,
    energyPerSecond: -BASE_ENERGY_DRAIN_PER_SECOND
  },
  moving: {
    satietyPerSecond: -BASE_SATIETY_DRAIN_PER_SECOND * 1.2,
    energyPerSecond: -BASE_ENERGY_DRAIN_PER_SECOND * 1.3
  },
  working: {
    satietyPerSecond:
      -BASE_SATIETY_DRAIN_PER_SECOND * WORKING_SATIETY_MULTIPLIER,
    energyPerSecond:
      -BASE_ENERGY_DRAIN_PER_SECOND * WORKING_ENERGY_MULTIPLIER
  },
  eating: {
    satietyPerSecond: EATING_SATIETY_RECOVERY_PER_SECOND,
    energyPerSecond: -BASE_ENERGY_DRAIN_PER_SECOND * 0.5
  },
  resting: {
    satietyPerSecond: -BASE_SATIETY_DRAIN_PER_SECOND * 0.5,
    energyPerSecond: RESTING_ENERGY_RECOVERY_PER_SECOND
  },
  wandering: {
    satietyPerSecond:
      -BASE_SATIETY_DRAIN_PER_SECOND * WANDERING_SATIETY_MULTIPLIER,
    energyPerSecond:
      -BASE_ENERGY_DRAIN_PER_SECOND * WANDERING_ENERGY_MULTIPLIER
  }
};

export type EvolveNeedsOptions = Readonly<{
  /** 若提供则替代 {@link DEFAULT_EVOLUTION_BY_BEHAVIOR} 中对应项。 */
  ratesByBehavior?: Partial<Record<BehaviorState, NeedEvolutionRates>>;
}>;

/**
 * 按经过的游戏时长与当前行为更新需求：内部用 {@link updateNeedProfile} 做 0..100 clamp 并重算阶段。
 */
export function evolveNeeds(
  profile: NeedSnapshot,
  gameDeltaSeconds: number,
  behaviorState: BehaviorState,
  options?: EvolveNeedsOptions
): NeedSnapshot {
  const override = options?.ratesByBehavior?.[behaviorState];
  const r = override ?? ratesForBehavior(behaviorState);
  const dt = Math.max(0, gameDeltaSeconds);
  return updateNeedProfile(
    profile,
    r.satietyPerSecond * dt,
    r.energyPerSecond * dt
  );
}
