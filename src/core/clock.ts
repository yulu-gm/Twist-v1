import { SimSpeed } from './types';

export interface SimulationClock {
  /** Total elapsed ticks */
  totalTicks: number;
  /** Current hour (0-23) */
  hour: number;
  /** Current day (1-based) */
  day: number;
  /** Current season (0-3) */
  season: number;
  /** Current year */
  year: number;
}

// Game time constants
const TICKS_PER_HOUR = 100;       // 10 seconds real time at 1x
const HOURS_PER_DAY = 24;
const DAYS_PER_SEASON = 15;
const SEASONS_PER_YEAR = 4;
const TICKS_PER_DAY = TICKS_PER_HOUR * HOURS_PER_DAY;
const TICKS_PER_SEASON = TICKS_PER_DAY * DAYS_PER_SEASON;
const TICKS_PER_YEAR = TICKS_PER_SEASON * SEASONS_PER_YEAR;

export const SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

export function createClock(): SimulationClock {
  return {
    totalTicks: 0,
    hour: 6, // start at 6 AM
    day: 1,
    season: 0,
    year: 1,
  };
}

export function advanceClock(clock: SimulationClock): void {
  clock.totalTicks++;

  // Derive time from total ticks + initial offset of 6 hours
  const totalWithOffset = clock.totalTicks + 6 * TICKS_PER_HOUR;
  clock.hour = Math.floor(totalWithOffset / TICKS_PER_HOUR) % HOURS_PER_DAY;
  clock.day = (Math.floor(totalWithOffset / TICKS_PER_DAY) % DAYS_PER_SEASON) + 1;
  clock.season = Math.floor(totalWithOffset / TICKS_PER_SEASON) % SEASONS_PER_YEAR;
  clock.year = Math.floor(totalWithOffset / TICKS_PER_YEAR) + 1;
}

export function getClockDisplay(clock: SimulationClock): string {
  return `Year ${clock.year}, ${SEASON_NAMES[clock.season]}, Day ${clock.day}, ${clock.hour}:00`;
}

export const BASE_TICK_MS = 100;

export function getTicksPerFrame(speed: SimSpeed, dtMs: number): number {
  if (speed === SimSpeed.Paused) return 0;
  const multiplier = speed === SimSpeed.Normal ? 1 : speed === SimSpeed.Fast ? 2 : 3;
  return Math.floor((dtMs * multiplier) / BASE_TICK_MS) || (speed > SimSpeed.Paused ? 1 : 0);
}
