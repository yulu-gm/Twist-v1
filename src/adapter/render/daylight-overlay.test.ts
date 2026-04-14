import { describe, expect, it } from 'vitest';
import { getDaylightOverlayState } from './daylight-overlay';
import type { SimulationClock } from '../../core/clock';

function makeClock(hour: number): SimulationClock {
  return {
    totalTicks: (hour - 6) * 100,
    hour,
    day: 1,
    season: 0,
    year: 1,
  };
}

describe('daylight overlay', () => {
  it('keeps the scene clear at midday', () => {
    const state = getDaylightOverlayState(makeClock(12));

    expect(state.timeSegment).toBe('day');
    expect(state.overlayAlpha).toBe(0);
    expect(state.overlayColor).toBe(0xf9fbff);
  });

  it('warms the scene during dawn', () => {
    const state = getDaylightOverlayState(makeClock(7));

    expect(state.timeSegment).toBe('dawn');
    expect(state.overlayAlpha).toBeGreaterThan(0);
    expect(state.overlayAlpha).toBeLessThan(0.32);
    expect(state.overlayColor).toBeGreaterThan(0x0b1630);
    expect(state.overlayColor).toBeLessThan(0xf2c48d + 1);
  });

  it('cools the scene during dusk', () => {
    const state = getDaylightOverlayState(makeClock(19));

    expect(state.timeSegment).toBe('dusk');
    expect(state.overlayAlpha).toBeGreaterThan(0);
    expect(state.overlayAlpha).toBeLessThan(0.32);
    expect(state.overlayColor).toBeGreaterThan(0x0b1630);
    expect(state.overlayColor).toBeLessThan(0x6d7bff + 1);
  });

  it('darkens the scene at night', () => {
    const state = getDaylightOverlayState(makeClock(2));

    expect(state.timeSegment).toBe('night');
    expect(state.overlayAlpha).toBeGreaterThan(0.25);
    expect(state.overlayColor).toBe(0x0b1630);
  });

  it('responds to sub-tick progress for smoother transitions', () => {
    const stateA = getDaylightOverlayState(makeClock(6), 0);
    const stateB = getDaylightOverlayState(makeClock(6), 1);

    expect(stateB.hourFloat).toBeGreaterThan(stateA.hourFloat);
    expect(stateB.overlayAlpha).toBeLessThan(stateA.overlayAlpha);
  });
});
