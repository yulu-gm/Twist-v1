/**
 * @file daylight-overlay.ts
 * @description 基于 world.clock 派生的全局昼夜过渡样式
 * @part-of adapter/render
 */

import { getTimeOfDayState } from '../../core/clock';
import type { SimulationClock, TimeOfDayState } from '../../core/clock';

const NIGHT_TINT = 0x0b1630;
const DAWN_TINT = 0xf2c48d;
const DUSK_TINT = 0x6d7bff;
const DAY_TINT = 0xf9fbff;
const MAX_OVERLAY_ALPHA = 0.32;

export interface DaylightOverlayState {
  timeSegment: TimeOfDayState['timeSegment'];
  daylightLevel: number;
  hourFloat: number;
  overlayColor: number;
  overlayAlpha: number;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function toRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

function fromRgb(r: number, g: number, b: number): number {
  return ((Math.round(r) & 0xff) << 16) | ((Math.round(g) & 0xff) << 8) | (Math.round(b) & 0xff);
}

function mixColor(from: number, to: number, t: number): number {
  const a = toRgb(from);
  const b = toRgb(to);
  return fromRgb(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  );
}

export function getDaylightOverlayState(clock: SimulationClock, tickProgress = 0): DaylightOverlayState {
  const tod = getTimeOfDayState({
    ...clock,
    totalTicks: clock.totalTicks + tickProgress,
  });
  const { timeSegment, daylightLevel, hourFloat } = tod;

  if (timeSegment === 'dawn') {
    return {
      timeSegment: 'dawn',
      daylightLevel,
      hourFloat,
      overlayColor: mixColor(NIGHT_TINT, DAWN_TINT, daylightLevel),
      overlayAlpha: clamp01((1 - daylightLevel) * MAX_OVERLAY_ALPHA),
    };
  }

  if (timeSegment === 'day') {
    return {
      timeSegment: 'day',
      daylightLevel,
      hourFloat,
      overlayColor: DAY_TINT,
      overlayAlpha: 0,
    };
  }

  if (timeSegment === 'dusk') {
    const duskProgress = clamp01(1 - daylightLevel);
    return {
      timeSegment: 'dusk',
      daylightLevel,
      hourFloat,
      overlayColor: mixColor(DUSK_TINT, NIGHT_TINT, duskProgress),
      overlayAlpha: clamp01((1 - daylightLevel) * MAX_OVERLAY_ALPHA),
    };
  }

  return {
    timeSegment: 'night',
    daylightLevel,
    hourFloat,
    overlayColor: NIGHT_TINT,
    overlayAlpha: clamp01((1 - daylightLevel) * MAX_OVERLAY_ALPHA),
  };
}
