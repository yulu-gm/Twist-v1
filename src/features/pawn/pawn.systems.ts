/**
 * @file pawn.systems.ts
 * @description 棋子需求衰减系统，每 tick 降低食物、休息、娱乐值并重新计算心情
 * @dependencies core/types — TickPhase, ObjectKind; core/tick-runner — 系统注册接口; world/world; pawn.types
 * @part-of features/pawn 棋子功能模块
 */

import { TickPhase, ObjectKind } from '../../core/types';
import type { SystemRegistration } from '../../core/tick-runner';
import type { World } from '../../world/world';
import type { Pawn } from './pawn.types';

// ── 需求衰减常量（0-100 刻度） ──
/** 每 tick 食物衰减量 */
const FOOD_DECAY_PER_TICK = 0.02;
/** 每 tick 休息衰减量 */
const REST_DECAY_PER_TICK = 0.015;
/** 每 tick 娱乐衰减量 */
const JOY_DECAY_PER_TICK = 0.01;

/**
 * 将数值限制在 0-100 范围内
 * @param v - 输入值
 * @returns 限制后的值
 */
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

// ── 系统注册配置 ──
/** 需求衰减系统注册：在 WORLD_UPDATE 阶段执行，每 10 tick 运行一次 */
export const needDecayRegistration: SystemRegistration = {
  id: 'pawn.needDecay',
  phase: TickPhase.WORLD_UPDATE,
  frequency: 10,
  execute: needDecaySystem,
};
