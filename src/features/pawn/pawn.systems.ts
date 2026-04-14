/**
 * @file pawn.systems.ts
 * @description 棋子需求衰减系统，每 tick 降低食物、休息、娱乐值并重新计算心情
 * @dependencies core/types — TickPhase, ObjectKind; core/tick-runner — 系统注册接口; world/world; pawn.types
 * @part-of features/pawn 棋子功能模块
 */

import { TickPhase, ObjectKind, ScheduleActivity } from '../../core/types';
import type { ScheduleEntry } from '../../core/types';
import type { SystemRegistration } from '../../core/tick-runner';
import type { SeededRandom } from '../../core/seeded-random';
import type { World } from '../../world/world';
import type { Pawn, PawnChronotype, PawnNeedsProfile, PawnThought, PawnTrait } from './pawn.types';

/** 需求系统每隔多少 tick 执行一次 */
const NEED_SYSTEM_INTERVAL_TICKS = 10;
/** 动态想法（如饥饿、疲劳）的默认持续时长（tick 数） */
const DYNAMIC_THOUGHT_DURATION = NEED_SYSTEM_INTERVAL_TICKS;

/** 内置特质定义表：特质ID -> 特质元数据及需求档案修改函数 */
interface PawnTraitDef extends PawnTrait {
  applyProfile?: (profile: PawnNeedsProfile) => void;
  applyChronotype?: (chronotype: PawnChronotype) => void;
}

const TRAIT_DEFS: Record<string, PawnTraitDef> = {
  glutton: {
    traitId: 'glutton',
    label: 'Glutton',
    description: 'Gets hungry sooner and eats more often.',
    applyProfile(profile) {
      profile.foodDecayPerTick += 0.01;
      profile.hungerSeekThreshold += 10;
    },
  },
  light_sleeper: {
    traitId: 'light_sleeper',
    label: 'Light Sleeper',
    description: 'Gets tired sooner and dislikes sleeping rough.',
    applyProfile(profile) {
      profile.restDecayPerTick += 0.01;
      profile.sleepSeekThreshold += 10;
      profile.floorSleepMoodPenalty += 6;
    },
  },
  hardy: {
    traitId: 'hardy',
    label: 'Hardy',
    description: 'Handles hunger and poor sleeping conditions better.',
    applyProfile(profile) {
      profile.hungerCriticalThreshold = Math.max(1, profile.hungerCriticalThreshold - 5);
      profile.starvationDamageInterval += 50;
      profile.starvationDamageAmount = Math.max(1, profile.starvationDamageAmount - 1);
      profile.floorSleepMoodPenalty = Math.max(0, profile.floorSleepMoodPenalty - 4);
    },
  },
  night_owl: {
    traitId: 'night_owl',
    label: 'Night Owl',
    description: 'Naturally stays up later and feels less sleep pressure at night.',
    applyChronotype(chronotype) {
      chronotype.scheduleShiftHours += 2;
      chronotype.nightOwlBias -= 0.35;
    },
  },
  high_energy: {
    traitId: 'high_energy',
    label: 'High Energy',
    description: 'Burns through rest more slowly and can stay active later.',
    applyProfile(profile) {
      profile.restDecayPerTick = Math.max(0.01, profile.restDecayPerTick - 0.012);
    },
    applyChronotype(chronotype) {
      chronotype.scheduleShiftHours += 1;
      chronotype.nightOwlBias -= 0.18;
    },
  },
};

/** 将数值限制在 [0, 100] 范围内 */
function clamp100(v: number): number {
  return v < 0 ? 0 : v > 100 ? 100 : v;
}

/** 将数值限制在不低于 min */
function clampMin(v: number, min: number): number {
  return v < min ? min : v;
}

function normalizeHour(hour: number): number {
  const normalized = hour % 24;
  return normalized < 0 ? normalized + 24 : normalized;
}

function finalizeChronotype(baseChronotype: PawnChronotype): PawnChronotype {
  const sleepStartHour = baseChronotype.sleepStartHour + baseChronotype.scheduleShiftHours;
  const sleepDurationHours = clampMin(baseChronotype.sleepDurationHours, 1);
  const sleepEndHour = sleepStartHour + sleepDurationHours;
  return {
    scheduleShiftHours: baseChronotype.scheduleShiftHours,
    sleepStartHour,
    sleepDurationHours,
    sleepEndHour,
    nightOwlBias: baseChronotype.nightOwlBias,
  };
}

export function createDefaultChronotype(rng: SeededRandom): PawnChronotype {
  return {
    scheduleShiftHours: rng.nextInt(-1, 2),
    sleepStartHour: 22,
    sleepDurationHours: 8,
    sleepEndHour: 30,
    nightOwlBias: 0,
  };
}

export function createScheduleEntriesForChronotype(chronotype: PawnChronotype): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const sleepStart = normalizeHour(chronotype.sleepStartHour);
  const sleepEnd = normalizeHour(chronotype.sleepEndHour);

  for (let hour = 0; hour < 24; hour++) {
    let activity = ScheduleActivity.Anything;
    const inSleepWindow = sleepStart === sleepEnd
      ? true
      : sleepStart < sleepEnd
        ? hour >= sleepStart && hour < sleepEnd
        : hour >= sleepStart || hour < sleepEnd;

    if (inSleepWindow) {
      activity = ScheduleActivity.Sleep;
    } else if (hour >= 18 && hour < sleepStart) {
      activity = ScheduleActivity.Joy;
    }

    entries.push({ hour, activity });
  }

  return entries;
}

/** 从棋子想法列表中移除指定类型（可选指定来源ID）的想法 */
function removeThought(pawn: Pawn, type: string, sourceId?: string): void {
  pawn.thoughts = pawn.thoughts.filter(thought => (
    thought.type !== type || thought.sourceId !== sourceId
  ));
}

/** 添加或刷新棋子的指定类型想法，若已存在则更新数值和剩余时长 */
export function addOrRefreshThought(
  pawn: Pawn,
  type: string,
  moodOffset: number,
  remainingTicks: number,
  sourceId?: string,
): void {
  const existing = pawn.thoughts.find(thought => (
    thought.type === type && thought.sourceId === sourceId
  ));
  if (existing) {
    existing.moodOffset = moodOffset;
    existing.remainingTicks = remainingTicks;
    return;
  }

  pawn.thoughts.push({
    type,
    moodOffset,
    remainingTicks,
    sourceId,
  });
}

/** 推进棋子所有想法的剩余时长，移除已过期的想法 */
function tickThoughts(pawn: Pawn): void {
  const nextThoughts: PawnThought[] = [];
  for (const thought of pawn.thoughts) {
    const remainingTicks = thought.remainingTicks - NEED_SYSTEM_INTERVAL_TICKS;
    if (remainingTicks > 0) {
      nextThoughts.push({ ...thought, remainingTicks });
    }
  }
  pawn.thoughts = nextThoughts;
}

/** 根据当前需求值同步动态想法（饥饿、疲劳等），确保只有对应状态的想法存在 */
function syncNeedThoughts(pawn: Pawn): void {
  if (pawn.needs.food <= 0) {
    addOrRefreshThought(pawn, 'Starving', -25, DYNAMIC_THOUGHT_DURATION);
    removeThought(pawn, 'Hungry');
  } else if (pawn.needs.food < pawn.needsProfile.hungerSeekThreshold) {
    addOrRefreshThought(pawn, 'Hungry', -8, DYNAMIC_THOUGHT_DURATION);
    removeThought(pawn, 'Starving');
  } else {
    removeThought(pawn, 'Hungry');
    removeThought(pawn, 'Starving');
  }

  if (pawn.needs.rest < pawn.needsProfile.sleepCriticalThreshold) {
    addOrRefreshThought(pawn, 'Exhausted', -14, DYNAMIC_THOUGHT_DURATION);
    removeThought(pawn, 'Tired');
  } else if (pawn.needs.rest < pawn.needsProfile.sleepSeekThreshold) {
    addOrRefreshThought(pawn, 'Tired', -6, DYNAMIC_THOUGHT_DURATION);
    removeThought(pawn, 'Exhausted');
  } else {
    removeThought(pawn, 'Tired');
    removeThought(pawn, 'Exhausted');
  }
}

/** 当食物值为0时，累计饥饿 tick 并按间隔扣除血量 */
function applyStarvationDamage(pawn: Pawn): void {
  if (pawn.needs.food > 0) {
    pawn.needsState.starvationTicks = 0;
    return;
  }

  pawn.needsState.starvationTicks += NEED_SYSTEM_INTERVAL_TICKS;
  const interval = clampMin(pawn.needsProfile.starvationDamageInterval, NEED_SYSTEM_INTERVAL_TICKS);
  while (pawn.needsState.starvationTicks >= interval) {
    pawn.needsState.starvationTicks -= interval;
    pawn.health.hp = Math.max(0, pawn.health.hp - pawn.needsProfile.starvationDamageAmount);
  }
}

/** 根据需求值和活跃想法重新计算并写入棋子心情值，返回计算结果 */
export function recomputeMood(pawn: Pawn): number {
  const needsMoodBase = (
    pawn.needs.food * 0.4 +
    pawn.needs.rest * 0.35 +
    pawn.needs.joy * 0.25
  );
  const activeThoughtSum = pawn.thoughts.reduce((sum, thought) => sum + thought.moodOffset, 0);
  const mood = clamp100(needsMoodBase + activeThoughtSum);
  pawn.needs.mood = mood;
  return mood;
}

/** 创建棋子需求档案的默认初始值 */
export function createDefaultNeedsProfile(): PawnNeedsProfile {
  return {
    foodDecayPerTick: 0.06,
    restDecayPerTick: 0.041,
    joyDecayPerTick: 0.01,
    hungerSeekThreshold: 35,
    hungerCriticalThreshold: 15,
    starvationDamageInterval: 100,
    starvationDamageAmount: 2,
    sleepSeekThreshold: 35,
    sleepCriticalThreshold: 20,
    wakeTargetRest: 95,
    bedRestGainPerTick: 0.12,
    floorRestGainPerTick: 0.08,
    floorSleepMoodPenalty: 8,
    mealTargetFood: 90,
  };
}

/** 将特质修改应用到基础需求档案，返回修改后的档案和特质元数据列表 */
export function applyTraitModifiers(
  baseProfile: PawnNeedsProfile,
  baseChronotype: PawnChronotype,
  traitIds: string[],
): { needsProfile: PawnNeedsProfile; chronotype: PawnChronotype; traits: PawnTrait[] } {
  const needsProfile: PawnNeedsProfile = { ...baseProfile };
  const chronotype: PawnChronotype = { ...baseChronotype };
  const traits: PawnTrait[] = [];

  for (const traitId of traitIds) {
    const trait = TRAIT_DEFS[traitId];
    if (!trait) continue;
    trait.applyProfile?.(needsProfile);
    trait.applyChronotype?.(chronotype);
    traits.push({
      traitId: trait.traitId,
      label: trait.label,
      description: trait.description,
    });
  }

  return { needsProfile, chronotype: finalizeChronotype(chronotype), traits };
}

export function needDecaySystem(world: World): void {
  for (const [, map] of world.maps) {
    const pawns = map.objects.allOfKind(ObjectKind.Pawn) as Pawn[];
    for (const pawn of pawns) {
      if (pawn.destroyed) continue;

      tickThoughts(pawn);

      pawn.needs.food = clamp100(
        pawn.needs.food - pawn.needsProfile.foodDecayPerTick * NEED_SYSTEM_INTERVAL_TICKS,
      );
      pawn.needs.rest = clamp100(
        pawn.needs.rest - pawn.needsProfile.restDecayPerTick * NEED_SYSTEM_INTERVAL_TICKS,
      );
      pawn.needs.joy = clamp100(
        pawn.needs.joy - pawn.needsProfile.joyDecayPerTick * NEED_SYSTEM_INTERVAL_TICKS,
      );

      applyStarvationDamage(pawn);
      syncNeedThoughts(pawn);
      recomputeMood(pawn);
    }
  }
}

export const needDecayRegistration: SystemRegistration = {
  id: 'pawn.needDecay',
  phase: TickPhase.WORLD_UPDATE,
  frequency: NEED_SYSTEM_INTERVAL_TICKS,
  execute: needDecaySystem,
};
