export type TimeOfDayState = Readonly<{
  dayNumber: number;
  minuteOfDay: number;
}>;

export type TimeOfDayConfig = Readonly<{
  realSecondsPerDay: number;
  startMinuteOfDay: number;
}>;

export type TimeOfDayPalette = Readonly<{
  backgroundColor: number;
  gridLineColor: number;
  gridBorderColor: number;
  primaryTextColor: number;
  secondaryTextColor: number;
}>;

export type TimeSpeed = 1 | 2 | 3;

export type TimeControlState = Readonly<{
  paused: boolean;
  speed: TimeSpeed;
}>;

type PaletteAnchor = Readonly<{
  minuteOfDay: number;
  palette: TimeOfDayPalette;
}>;

const MINUTES_PER_DAY = 24 * 60;

export const DEFAULT_TIME_OF_DAY_CONFIG: TimeOfDayConfig = {
  realSecondsPerDay: 10 * 60,
  startMinuteOfDay: 6 * 60
};

export const DEFAULT_TIME_CONTROL_STATE: TimeControlState = {
  paused: false,
  speed: 1
};

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

function normalizeTimeState(state: TimeOfDayState): TimeOfDayState {
  const totalMinutes =
    (Math.max(1, state.dayNumber) - 1) * MINUTES_PER_DAY + state.minuteOfDay;
  const normalizedDayOffset = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const normalizedMinuteOfDay =
    ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  return {
    dayNumber: normalizedDayOffset + 1,
    minuteOfDay: normalizedMinuteOfDay
  };
}

function minutesPerSecond(config: TimeOfDayConfig): number {
  if (config.realSecondsPerDay <= 0) {
    throw new Error("time-of-day: realSecondsPerDay must be positive");
  }
  return MINUTES_PER_DAY / config.realSecondsPerDay;
}

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

export function createInitialTimeOfDayState(
  config: TimeOfDayConfig = DEFAULT_TIME_OF_DAY_CONFIG
): TimeOfDayState {
  return normalizeTimeState({
    dayNumber: 1,
    minuteOfDay: config.startMinuteOfDay
  });
}

export function advanceTimeOfDay(
  state: TimeOfDayState,
  deltaSeconds: number,
  config: TimeOfDayConfig = DEFAULT_TIME_OF_DAY_CONFIG
): TimeOfDayState {
  if (deltaSeconds === 0) return normalizeTimeState(state);

  return normalizeTimeState({
    dayNumber: state.dayNumber,
    minuteOfDay: state.minuteOfDay + deltaSeconds * minutesPerSecond(config)
  });
}

export function effectiveSimulationDeltaSeconds(
  deltaSeconds: number,
  controls: TimeControlState = DEFAULT_TIME_CONTROL_STATE
): number {
  return controls.paused ? 0 : deltaSeconds * controls.speed;
}

export function formatTimeOfDayLabel(state: TimeOfDayState): string {
  const normalized = normalizeTimeState(state);
  const totalMinutes = Math.floor(normalized.minuteOfDay);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `Day ${normalized.dayNumber} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
