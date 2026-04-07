import { TickPhase, ObjectKind } from '../../core/types';
import type { SystemRegistration } from '../../core/tick-runner';
import type { World } from '../../world/world';
import type { Pawn } from './pawn.types';

// ── Need decay constants (0-100 scale) ──
const FOOD_DECAY_PER_TICK = 0.02;
const REST_DECAY_PER_TICK = 0.015;
const JOY_DECAY_PER_TICK = 0.01;

function clamp100(v: number): number {
  return v < 0 ? 0 : v > 100 ? 100 : v;
}

/**
 * Reduces food, rest, and joy each tick and recalculates mood.
 * All needs use 0-100 scale.
 * Mood is a weighted average of the three needs.
 */
export function needDecaySystem(world: World): void {
  for (const [, map] of world.maps) {
    const pawns = map.objects.allOfKind(ObjectKind.Pawn) as Pawn[];
    for (const pawn of pawns) {
      if (pawn.destroyed) continue;

      pawn.needs.food = clamp100(pawn.needs.food - FOOD_DECAY_PER_TICK);
      pawn.needs.rest = clamp100(pawn.needs.rest - REST_DECAY_PER_TICK);
      pawn.needs.joy = clamp100(pawn.needs.joy - JOY_DECAY_PER_TICK);

      // Mood = weighted average: food 40%, rest 35%, joy 25%
      pawn.needs.mood = clamp100(
        pawn.needs.food * 0.4 +
        pawn.needs.rest * 0.35 +
        pawn.needs.joy * 0.25
      );
    }
  }
}

// ── System registration ──
export const needDecayRegistration: SystemRegistration = {
  id: 'pawn.needDecay',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 10,
  execute: needDecaySystem,
};
