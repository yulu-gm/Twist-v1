/**
 * @file clock.ts
 * @description 模拟时钟系统，管理游戏内时间（小时/天/季节/年）的推进与显示
 * @dependencies types.ts (SimSpeed)
 * @part-of core 核心模块 — 驱动游戏世界的时间流逝
 */

import { SimSpeed } from './types';

/** 模拟时钟状态接口 — 记录当前游戏时间 */
export interface SimulationClock {
  /** Total elapsed ticks */
  /** 已经过的总 tick 数 */
  totalTicks: number;
  /** Current hour (0-23) */
  /** 当前小时 (0-23) */
  hour: number;
  /** Current day (1-based) */
  /** 当前天数（从 1 开始） */
  day: number;
  /** Current season (0-3) */
  /** 当前季节索引 (0=春, 1=夏, 2=秋, 3=冬) */
  season: number;
  /** Current year */
  /** 当前年份 */
  year: number;
}

export interface TimeOfDayState {
  timeSegment: 'dawn' | 'day' | 'dusk' | 'night';
  daylightLevel: number;
  isNight: boolean;
  hourFloat: number;
}

// ── 游戏时间常量 ──
const TICKS_PER_HOUR = 100;                               // 每小时的 tick 数（1x 速度下约 10 秒真实时间）
const HOURS_PER_DAY = 24;                                  // 每天的小时数
const DAYS_PER_SEASON = 15;                                // 每季的天数
const SEASONS_PER_YEAR = 4;                                // 每年的季节数
const TICKS_PER_DAY = TICKS_PER_HOUR * HOURS_PER_DAY;     // 每天的 tick 数
const TICKS_PER_SEASON = TICKS_PER_DAY * DAYS_PER_SEASON;  // 每季的 tick 数
const TICKS_PER_YEAR = TICKS_PER_SEASON * SEASONS_PER_YEAR; // 每年的 tick 数

/** 季节名称（英文） */
export const SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

/**
 * 创建初始时钟状态
 * @returns 从第 1 年春季第 1 天早上 6 点开始的时钟
 */
export function createClock(): SimulationClock {
  return {
    totalTicks: 0,
    hour: 6, // start at 6 AM
    day: 1,
    season: 0,
    year: 1,
  };
}

/**
 * 推进时钟一个 tick，并根据总 tick 数重新计算时/日/季/年
 * @param clock - 要推进的时钟对象（会被原地修改）
 */
export function advanceClock(clock: SimulationClock): void {
  clock.totalTicks++;

  // Derive time from total ticks + initial offset of 6 hours
  const totalWithOffset = clock.totalTicks + 6 * TICKS_PER_HOUR;
  clock.hour = Math.floor(totalWithOffset / TICKS_PER_HOUR) % HOURS_PER_DAY;
  clock.day = (Math.floor(totalWithOffset / TICKS_PER_DAY) % DAYS_PER_SEASON) + 1;
  clock.season = Math.floor(totalWithOffset / TICKS_PER_SEASON) % SEASONS_PER_YEAR;
  clock.year = Math.floor(totalWithOffset / TICKS_PER_YEAR) + 1;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeHour(hour: number): number {
  const normalized = hour % HOURS_PER_DAY;
  return normalized < 0 ? normalized + HOURS_PER_DAY : normalized;
}

export function getHourFloat(clock: SimulationClock): number {
  const totalWithOffset = clock.totalTicks + 6 * TICKS_PER_HOUR;
  const hourFloat = (totalWithOffset / TICKS_PER_HOUR) % HOURS_PER_DAY;
  return normalizeHour(hourFloat);
}

export function isHourWithinWindow(hourFloat: number, startHour: number, endHour: number): boolean {
  const hour = normalizeHour(hourFloat);
  const start = normalizeHour(startHour);
  const end = normalizeHour(endHour);

  if (start === end) return true;
  if (start < end) {
    return hour >= start && hour < end;
  }
  return hour >= start || hour < end;
}

export function getTimeOfDayState(clock: SimulationClock): TimeOfDayState {
  const hourFloat = getHourFloat(clock);
  let timeSegment: TimeOfDayState['timeSegment'];
  let daylightLevel: number;

  if (hourFloat >= 6 && hourFloat < 8) {
    timeSegment = 'dawn';
    daylightLevel = clamp01((hourFloat - 6) / 2);
  } else if (hourFloat >= 8 && hourFloat < 18) {
    timeSegment = 'day';
    daylightLevel = 1;
  } else if (hourFloat >= 18 && hourFloat < 20) {
    timeSegment = 'dusk';
    daylightLevel = clamp01(1 - ((hourFloat - 18) / 2));
  } else {
    timeSegment = 'night';
    daylightLevel = 0.08;
  }

  return {
    timeSegment,
    daylightLevel,
    isNight: timeSegment === 'night',
    hourFloat,
  };
}

/**
 * 生成时钟的可读显示字符串
 * @param clock - 时钟状态
 * @returns 格式如 "Year 1, Spring, Day 1, 6:00"
 */
export function getClockDisplay(clock: SimulationClock): string {
  return `Year ${clock.year}, ${SEASON_NAMES[clock.season]}, Day ${clock.day}, ${clock.hour}:00`;
}

/** 基准 tick 间隔（毫秒），1x 速度下每 100ms 一个 tick */
export const BASE_TICK_MS = 100;

/**
 * 根据模拟速度和帧间隔计算本帧应执行的 tick 数
 * @param speed - 当前模拟速度档位
 * @param dtMs - 距上一帧的毫秒数
 * @returns 本帧应执行的 tick 数（暂停时为 0）
 */
export function getTicksPerFrame(speed: SimSpeed, dtMs: number): number {
  if (speed === SimSpeed.Paused) return 0;
  const multiplier = speed === SimSpeed.Normal ? 1 : speed === SimSpeed.Fast ? 2 : 3;
  return Math.floor((dtMs * multiplier) / BASE_TICK_MS) || (speed > SimSpeed.Paused ? 1 : 0);
}
