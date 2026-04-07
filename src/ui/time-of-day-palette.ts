import { normalizeTimeState, type TimeOfDayState } from "../game/time/time-of-day";

/** 栅格/HUD 等展示用配色；与领域时间状态分离，由 UI 侧按日内时刻插值。 */
export type TimeOfDayPalette = Readonly<{
  backgroundColor: number;
  gridLineColor: number;
  gridBorderColor: number;
  primaryTextColor: number;
  secondaryTextColor: number;
}>;

type PaletteAnchor = Readonly<{
  minuteOfDay: number;
  palette: TimeOfDayPalette;
}>;

const MINUTES_PER_DAY = 24 * 60;

const MIDNIGHT_PALETTE: TimeOfDayPalette = {
  backgroundColor: 0x171411,
  gridLineColor: 0x312c26,
  gridBorderColor: 0x4a4238,
  primaryTextColor: 0xd8cbb8,
  secondaryTextColor: 0xa69782
};

const TIME_OF_DAY_ANCHORS: readonly PaletteAnchor[] = [
  {
    minuteOfDay: 0,
    palette: MIDNIGHT_PALETTE
  },
  {
    minuteOfDay: 6 * 60,
    palette: {
      backgroundColor: 0x7a6f61,
      gridLineColor: 0x4a4339,
      gridBorderColor: 0x6b6153,
      primaryTextColor: 0xefe2c7,
      secondaryTextColor: 0xc5b69f
    }
  },
  {
    minuteOfDay: 12 * 60,
    palette: {
      backgroundColor: 0xd8c7a3,
      gridLineColor: 0x7c6f5d,
      gridBorderColor: 0xa08f77,
      primaryTextColor: 0xfbf4e1,
      secondaryTextColor: 0xe5d4bb
    }
  },
  {
    minuteOfDay: 18 * 60,
    palette: {
      backgroundColor: 0x6f5f57,
      gridLineColor: 0x4f473d,
      gridBorderColor: 0x6f6457,
      primaryTextColor: 0xf1e5d0,
      secondaryTextColor: 0xc8b79d
    }
  },
  {
    minuteOfDay: MINUTES_PER_DAY,
    palette: MIDNIGHT_PALETTE
  }
] as const;

function lerpNumber(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function lerpChannel(start: number, end: number, t: number): number {
  return Math.round(lerpNumber(start, end, t));
}

function splitColor(color: number): readonly [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

function mergeColor(red: number, green: number, blue: number): number {
  return (red << 16) | (green << 8) | blue;
}

function lerpColor(start: number, end: number, t: number): number {
  const [startRed, startGreen, startBlue] = splitColor(start);
  const [endRed, endGreen, endBlue] = splitColor(end);
  return mergeColor(
    lerpChannel(startRed, endRed, t),
    lerpChannel(startGreen, endGreen, t),
    lerpChannel(startBlue, endBlue, t)
  );
}

function lerpPalette(
  start: TimeOfDayPalette,
  end: TimeOfDayPalette,
  t: number
): TimeOfDayPalette {
  return {
    backgroundColor: lerpColor(start.backgroundColor, end.backgroundColor, t),
    gridLineColor: lerpColor(start.gridLineColor, end.gridLineColor, t),
    gridBorderColor: lerpColor(start.gridBorderColor, end.gridBorderColor, t),
    primaryTextColor: lerpColor(start.primaryTextColor, end.primaryTextColor, t),
    secondaryTextColor: lerpColor(start.secondaryTextColor, end.secondaryTextColor, t)
  };
}

export function sampleTimeOfDayPalette(state: TimeOfDayState): TimeOfDayPalette {
  const normalized = normalizeTimeState(state);

  for (let i = 0; i < TIME_OF_DAY_ANCHORS.length - 1; i++) {
    const current = TIME_OF_DAY_ANCHORS[i]!;
    const next = TIME_OF_DAY_ANCHORS[i + 1]!;
    if (normalized.minuteOfDay > next.minuteOfDay) continue;

    const span = next.minuteOfDay - current.minuteOfDay;
    const t = span <= 0 ? 0 : (normalized.minuteOfDay - current.minuteOfDay) / span;
    return lerpPalette(current.palette, next.palette, t);
  }

  return MIDNIGHT_PALETTE;
}
