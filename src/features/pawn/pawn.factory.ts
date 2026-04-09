/**
 * @file pawn.factory.ts
 * @description 棋子工厂函数，负责创建新的棋子实例并初始化默认属性
 * @dependencies core/types — 对象ID生成、日程活动枚举等; core/seeded-random — 种子随机数; pawn.types — 棋子接口
 * @part-of features/pawn 棋子功能模块
 */

import {
  ObjectKind,
  nextObjectId,
  ScheduleActivity,
} from '../../core/types';
import type {
  CellCoord,
  MapId,
  FactionId,
  ScheduleEntry,
  SkillId,
  SkillLevel,
} from '../../core/types';
import type { SeededRandom } from '../../core/seeded-random';
import type { Pawn } from './pawn.types';

/**
 * 生成默认的24小时日程安排
 * 0-5点睡觉，6-21点自由活动，22-23点娱乐
 * @returns 24个小时的日程条目数组
 */
function defaultSchedule(): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  for (let h = 0; h < 24; h++) {
    let activity: ScheduleActivity;
    if (h < 6) {
      activity = ScheduleActivity.Sleep;
    } else if (h >= 22) {
      activity = ScheduleActivity.Joy;
    } else {
      activity = ScheduleActivity.Anything;
    }
    entries.push({ hour: h, activity });
  }
  return entries;
}

/**
 * 生成每个棋子的基础技能表
 * 包含采矿、建造、种植、搬运四项初始技能，等级和经验均为0
 * @returns 技能ID到技能等级的映射
 */
function defaultSkills(): Record<SkillId, SkillLevel> {
  const base: Record<SkillId, SkillLevel> = {};
  const defaultIds: SkillId[] = ['mining', 'construction', 'growing', 'hauling'];
  for (const id of defaultIds) {
    base[id] = { level: 0, xp: 0 };
  }
  return base;
}

/**
 * 创建一个新的棋子实例
 * @param params.name - 棋子名称
 * @param params.cell - 初始格子坐标
 * @param params.mapId - 所属地图ID
 * @param params.factionId - 所属阵营ID
 * @param params.rng - 种子随机数生成器（预留用于随机化属性）
 * @returns 完整初始化的棋子对象
 */
export function createPawn(params: {
  name: string;
  cell: CellCoord;
  mapId: MapId;
  factionId: FactionId;
  rng: SeededRandom;
}): Pawn {
  const { name, cell, mapId, factionId } = params;

  return {
    id: nextObjectId(),
    kind: ObjectKind.Pawn,
    defId: 'pawn',
    mapId,
    cell: { x: cell.x, y: cell.y },
    tags: new Set(['selectable', 'pawn']),
    destroyed: false,

    name,
    factionId,
    drafted: false,

    movement: {
      path: [],
      pathIndex: 0,
      moveProgress: 0,
      speed: 1,
      prevCell: null,
    },

    needs: {
      food: 100,
      rest: 100,
      joy: 100,
      mood: 50,
    },

    health: {
      hp: 100,
      maxHp: 100,
      injuries: [],
    },

    skills: defaultSkills(),

    inventory: {
      carrying: null,
      carryCapacity: 75,
    },

    ai: {
      currentJob: null,
      currentToilIndex: 0,
      toilState: {},
      idleTicks: 0,
    },

    schedule: {
      entries: defaultSchedule(),
    },
  };
}
