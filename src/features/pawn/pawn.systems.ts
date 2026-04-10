/**
 * @file pawn.systems.ts
 * @description 妫嬪瓙闇€姹傝“鍑忕郴缁燂紝姣?tick 闄嶄綆椋熺墿銆佷紤鎭€佸ū涔愬€煎苟閲嶆柊璁＄畻蹇冩儏
 * @dependencies core/types 鈥?TickPhase, ObjectKind; core/tick-runner 鈥?绯荤粺娉ㄥ唽鎺ュ彛; world/world; pawn.types
 * @part-of features/pawn 妫嬪瓙鍔熻兘妯″潡
 */

import { TickPhase, ObjectKind } from '../../core/types';
import type { SystemRegistration } from '../../core/tick-runner';
import type { World } from '../../world/world';
import type { Pawn, PawnNeedsProfile, PawnThought, PawnTrait } from './pawn.types';

const NEED_SYSTEM_INTERVAL_TICKS = 10;
const DYNAMIC_THOUGHT_DURATION = NEED_SYSTEM_INTERVAL_TICKS;

const TRAIT_DEFS: Record<string, PawnTrait & { apply: (profile: PawnNeedsProfile) => void }> = {
  glutton: {
    traitId: 'glutton',
    label: 'Glutton',
    description: 'Gets hungry sooner and eats more often.',
    apply(profile) {
      profile.foodDecayPerTick += 0.01;
      profile.hungerSeekThreshold += 10;
    },
  },
  light_sleeper: {
    traitId: 'light_sleeper',
    label: 'Light Sleeper',
    description: 'Gets tired sooner and dislikes sleeping rough.',
    apply(profile) {
      profile.restDecayPerTick += 0.01;
      profile.sleepSeekThreshold += 10;
      profile.floorSleepMoodPenalty += 6;
    },
  },
  hardy: {
    traitId: 'hardy',
    label: 'Hardy',
    description: 'Handles hunger and poor sleeping conditions better.',
    apply(profile) {
      profile.hungerCriticalThreshold = Math.max(1, profile.hungerCriticalThreshold - 5);
      profile.starvationDamageInterval += 50;
      profile.starvationDamageAmount = Math.max(1, profile.starvationDamageAmount - 1);
      profile.floorSleepMoodPenalty = Math.max(0, profile.floorSleepMoodPenalty - 4);
    },
  },
};

function clamp100(v: number): number {
  return v < 0 ? 0 : v > 100 ? 100 : v;
}

function clampMin(v: number, min: number): number {
  return v < min ? min : v;
}

function removeThought(pawn: Pawn, type: string, sourceId?: string): void {
  pawn.thoughts = pawn.thoughts.filter(thought => (
    thought.type !== type || thought.sourceId !== sourceId
  ));
}

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

export function applyTraitModifiers(
  baseProfile: PawnNeedsProfile,
  traitIds: string[],
): { needsProfile: PawnNeedsProfile; traits: PawnTrait[] } {
  const needsProfile: PawnNeedsProfile = { ...baseProfile };
  const traits: PawnTrait[] = [];

  for (const traitId of traitIds) {
    const trait = TRAIT_DEFS[traitId];
    if (!trait) continue;
    trait.apply(needsProfile);
    traits.push({
      traitId: trait.traitId,
      label: trait.label,
      description: trait.description,
    });
  }

  return { needsProfile, traits };
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
