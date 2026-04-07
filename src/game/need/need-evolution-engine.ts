import type { BehaviorState } from "../behavior/behavior-state-machine";
import {
  type NeedSnapshot,
  updateNeedProfile
} from "./need-profile";

/**
 * 进食/休息的饱食、精力**正向恢复**在运行时只应走一条时间路径（与 `oh-code-design/需求系统.yaml` 中
 * 「时间驱动演化」与「需求满足结算器」分工一致，避免同一时段双重结算）：
 *
 * - **主模拟 tick**：由 {@link evolveNeeds}（经 `advancePawnNeedsWithBehavior`）按当前 `eating` /
 *   `resting` 行为逐帧推进；此区间内不得再对同一时段调用 {@link settleEating} / {@link settleResting}。
 * - **离散结算**：`satisfaction-settler` 的 settle* 用于**未**经上述 tick 覆盖的时长（例如场景快进、单测、
 *   中断部分恢复等），速率常量与下表保持一致。
 *
 * - **昼夜（AP-0140）**：主 tick 经 {@link EvolveNeedsOptions.timePeriod} 注入与 `world-time` 同源的
 *   `day`/`night`；仅对**精力净消耗**（`energyPerSecond` 为负）乘 {@link NIGHT_ENERGY_NEGATIVE_RATE_MULTIPLIER}，
 *   与 `oh-gen-doc/需求系统.yaml`「白天活动时精力自然下降」的时段语义衔接，避免仅靠静态表表达昼夜差异。
 */

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

/**
 * 与 `world-time` 的 `TimePeriod` 字符串一致；由模拟 tick 显式传入，避免需求层反向依赖时间模块。
 */
export type NeedEvolutionTimePeriod = "day" | "night";

/**
 * 夜间对精力**消耗项**的倍率（小于 1 表示夜间同行为下精力掉得略慢，可调参）。
 * 仅作用于精力速率为负时；进食/休息等正向恢复不受本系数影响。
 */
export const NIGHT_ENERGY_NEGATIVE_RATE_MULTIPLIER = 0.88;

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
  /**
   * 当前游戏日相；`night` 时对精力净消耗乘 {@link NIGHT_ENERGY_NEGATIVE_RATE_MULTIPLIER}。
   * 未传则不做昼夜修正（兼容离散结算/单测）。
   */
  timePeriod?: NeedEvolutionTimePeriod;
}>;

/**
 * 按经过的游戏时长与当前行为更新需求：内部用 {@link updateNeedProfile} 做 0..100 clamp 并重算阶段。
 *
 * 对 `eating` / `resting` 的恢复量与 `satisfaction-settler` 同源；与 settle* **二选一**覆盖同一段
 * `gameDeltaSeconds`，不可叠加（见文件顶部契约）。
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
  let energyRate = r.energyPerSecond;
  if (options?.timePeriod === "night" && energyRate < 0) {
    energyRate *= NIGHT_ENERGY_NEGATIVE_RATE_MULTIPLIER;
  }
  return updateNeedProfile(
    profile,
    r.satietyPerSecond * dt,
    energyRate * dt
  );
}
