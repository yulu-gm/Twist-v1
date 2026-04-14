import { describe, expect, it } from 'vitest';
import { createClock, getHourFloat, getTimeOfDayState, isHourWithinWindow } from './clock';

function setClockHour(clock: ReturnType<typeof createClock>, hourFloat: number): void {
  let deltaHours = hourFloat - 6;
  if (deltaHours < 0) deltaHours += 24;
  clock.totalTicks = Math.round(deltaHours * 100);
  clock.hour = Math.floor(hourFloat) % 24;
}

describe('clock TOD helpers', () => {
  it('derives fractional hour from total ticks', () => {
    const clock = createClock();
    setClockHour(clock, 12.5);

    expect(getHourFloat(clock)).toBeCloseTo(12.5, 5);
  });

  it('returns day with high daylight level at noon', () => {
    const clock = createClock();
    setClockHour(clock, 12);

    const tod = getTimeOfDayState(clock);
    expect(tod.timeSegment).toBe('day');
    expect(tod.daylightLevel).toBeGreaterThan(0.9);
    expect(tod.isNight).toBe(false);
  });

  it('returns night with low daylight level after midnight', () => {
    const clock = createClock();
    setClockHour(clock, 1);

    const tod = getTimeOfDayState(clock);
    expect(tod.timeSegment).toBe('night');
    expect(tod.daylightLevel).toBeLessThan(0.15);
    expect(tod.isNight).toBe(true);
  });

  it('handles windows that wrap past midnight', () => {
    expect(isHourWithinWindow(23.5, 22, 6)).toBe(true);
    expect(isHourWithinWindow(2, 22, 6)).toBe(true);
    expect(isHourWithinWindow(12, 22, 6)).toBe(false);
  });
});
