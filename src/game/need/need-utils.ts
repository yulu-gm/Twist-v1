import type { BehaviorState } from "../behavior/behavior-state-machine";
import type { NeedKind, PawnNeeds, PawnState } from "../pawn-state";
import {
  BASE_ENERGY_DRAIN_PER_SECOND,
  BASE_SATIETY_DRAIN_PER_SECOND,
  evolveNeeds,
  type NeedEvolutionTimePeriod
} from "./need-evolution-engine";
import { createNeedProfile, updateNeedProfile } from "./need-profile";
import {
  evaluateFatigueStage,
  evaluateHungerStage,
  type NeedStage
} from "./threshold-rules";

/** 与 {@link describePawnDebugLabel} 同源，供需求模块与 pawn-state 共用。 */
export function formatPawnDebugLabel(pawn: PawnState): string {
  const goal = pawn.currentGoal?.kind ?? "none";
  const action = pawn.currentAction?.kind ?? "idle";
  const targetId = pawn.currentAction?.targetId ?? pawn.currentGoal?.targetId ?? pawn.reservedTargetId;
  return targetId
    ? `goal:${goal} action:${action} target:${targetId}`
    : `goal:${goal} action:${action}`;
}

function clampNeedValue(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function withDebugLabel(pawn: PawnState): PawnState {
  return {
    ...pawn,
    hungerStage: evaluateHungerStage(pawn.satiety),
    fatigueStage: evaluateFatigueStage(pawn.energy),
    debugLabel: formatPawnDebugLabel(pawn)
  };
}

export const DEFAULT_PAWN_NEEDS: PawnNeeds = {
  hunger: 20,
  rest: 10,
  recreation: 20
};

/** 与默认小人初始值对齐：饱食 100 ↔ 饥饿紧迫 20；精力 100 ↔ 休息紧迫 10 */
export const PAWN_HUNGER_SATIETY_ANCHOR = DEFAULT_PAWN_NEEDS.hunger + 100;
export const PAWN_REST_ENERGY_ANCHOR = DEFAULT_PAWN_NEEDS.rest + 100;

/**
 * 从 {@link PawnState.satiety} / {@link PawnState.energy} 推导饥饿、疲劳阶段，与
 * {@link evaluateHungerStage} / {@link evaluateFatigueStage}（`threshold-rules`）同源。
 * 行为与流程层持有 {@link PawnState} 时应经此读取离散阶段，与 {@link createNeedProfile} 快照一致。
 */
export function pawnNeedStages(pawn: PawnState): Readonly<{
  hungerStage: NeedStage;
  fatigueStage: NeedStage;
}> {
  return {
    hungerStage: evaluateHungerStage(pawn.satiety),
    fatigueStage: evaluateFatigueStage(pawn.energy)
  };
}

/** `hunger`/`rest` 由标量派生；`recreation` 仍为独立紧迫轴（仅存于三元组第三维）。 */
export function pawnNeedsFromScalars(
  satiety: number,
  energy: number,
  recreation: number
): PawnNeeds {
  return {
    hunger: clampNeedValue(PAWN_HUNGER_SATIETY_ANCHOR - satiety),
    rest: clampNeedValue(PAWN_REST_ENERGY_ANCHOR - energy),
    recreation: clampNeedValue(recreation)
  };
}

/** 在仅改了 `satiety`/`energy` 或合并 overrides 后，重算 `needs.hunger`/`needs.rest`（AP-0152）。 */
export function normalizePawnNeedSnapshot(pawn: PawnState): PawnState {
  return withDebugLabel({
    ...pawn,
    needs: pawnNeedsFromScalars(pawn.satiety, pawn.energy, pawn.needs.recreation)
  });
}

/** 测试/编排用：按给定紧迫度反推 `satiety`/`energy`，保证与派生公式一致。 */
export function withPawnNeeds(pawn: PawnState, needs: PawnNeeds): PawnState {
  const hunger = clampNeedValue(needs.hunger);
  const rest = clampNeedValue(needs.rest);
  const recreation = clampNeedValue(needs.recreation);
  return withDebugLabel({
    ...pawn,
    satiety: clampNeedValue(PAWN_HUNGER_SATIETY_ANCHOR - hunger),
    energy: clampNeedValue(PAWN_REST_ENERGY_ANCHOR - rest),
    needs: { hunger, rest, recreation }
  });
}

/**
 * 按固定「每秒变化率」线性推进 `needs` 并与 `satiety`/`energy` 双写。
 *
 * **行为上下文**：本函数不读取 `pawn` 上的行为/活动状态；若需求应随进食、休息、工种等变化，
 * 调用方须先把该上下文折算进 `ratesPerSecond`，或改用主循环路径上的
 * {@link advancePawnNeedsWithBehavior}（经 `evolveNeeds` 按 `BehaviorState` 分档）。
 */
export function advanceNeeds(
  pawn: PawnState,
  deltaSeconds: number,
  ratesPerSecond: Record<NeedKind, number>
): PawnState {
  const dh = ratesPerSecond.hunger * deltaSeconds;
  const dr = ratesPerSecond.rest * deltaSeconds;
  const drec = ratesPerSecond.recreation * deltaSeconds;
  const satiety = clampNeedValue(pawn.satiety - dh);
  const energy = clampNeedValue(pawn.energy - dr);
  const recreation = clampNeedValue(pawn.needs.recreation + drec);
  return withDebugLabel({
    ...pawn,
    satiety,
    energy,
    needs: pawnNeedsFromScalars(satiety, energy, recreation)
  });
}

/**
 * 模拟 tick 用：按 {@link evolveNeeds} 的行为分档形状推进 `satiety`/`energy`；`needs.hunger`/`needs.rest`
 * 由标量派生，不再与 `advanceNeeds` 类路径并行维护两套增量。
 *
 * 负向变化（消耗）按 `needGrowthPerSec` 与基准 idle 消耗的比缩放，以衔接既有 `SimConfig` 量纲；
 * 正向恢复（进食/休息等）保持引擎表内绝对速率，避免被配置放大。
 *
 * 与同速率的 `settleEating`/`settleResting` 互斥覆盖同一 `deltaSeconds`（见 need-evolution-engine 顶部说明）。
 *
 * `timePeriod` 传入与 `tickSimulation` 解析的昼夜一致，驱动精力净消耗的时段倍率（AP-0140）。
 */
export function advancePawnNeedsWithBehavior(
  pawn: PawnState,
  deltaSeconds: number,
  behavior: BehaviorState,
  needGrowthPerSec: Readonly<Record<NeedKind, number>>,
  timePeriod?: NeedEvolutionTimePeriod
): PawnState {
  const profile = createNeedProfile(pawn.id, pawn.satiety, pawn.energy);
  const raw = evolveNeeds(profile, deltaSeconds, behavior, {
    timePeriod
  });
  let ds = raw.satiety - pawn.satiety;
  let de = raw.energy - pawn.energy;
  if (ds < 0) {
    ds *= needGrowthPerSec.hunger / BASE_SATIETY_DRAIN_PER_SECOND;
  }
  if (de < 0) {
    de *= needGrowthPerSec.rest / BASE_ENERGY_DRAIN_PER_SECOND;
  }
  const next = updateNeedProfile(profile, ds, de);
  const drec = needGrowthPerSec.recreation * deltaSeconds;
  const recreation = clampNeedValue(pawn.needs.recreation + drec);
  return withDebugLabel({
    ...pawn,
    satiety: next.satiety,
    energy: next.energy,
    needs: pawnNeedsFromScalars(next.satiety, next.energy, recreation)
  });
}

export function applyNeedDelta(
  pawn: PawnState,
  deltas: Partial<Record<NeedKind, number>>
): PawnState {
  const dh = deltas.hunger ?? 0;
  const dr = deltas.rest ?? 0;
  const drec = deltas.recreation ?? 0;
  const satiety = clampNeedValue(pawn.satiety - dh);
  const energy = clampNeedValue(pawn.energy - dr);
  const recreation = clampNeedValue(pawn.needs.recreation + drec);
  return withDebugLabel({
    ...pawn,
    satiety,
    energy,
    needs: pawnNeedsFromScalars(satiety, energy, recreation)
  });
}
