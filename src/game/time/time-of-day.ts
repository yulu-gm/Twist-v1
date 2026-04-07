/**
 * 时间模型与推进的纯函数子集：日内分钟换算、昼夜相位、仿真步长钳制等。
 * 展示用昼夜调色采样见 `src/ui/time-of-day-palette.ts`。
 *
 * 「时间事件总线」与合并控制态的「统一时间快照」由游戏时钟编排层组装与持有（见 `world-time.ts`、
 * `world-core`）；本模块不发布/订阅时段或跨天事件。编排层可用 `diffDayNightPhaseTransition` 等
 * 在接入总线前识别昼夜切换点。
 */
export type TimeOfDayState = Readonly<{
  dayNumber: number;
  minuteOfDay: number;
}>;

export type TimeOfDayConfig = Readonly<{
  realSecondsPerDay: number;
  startMinuteOfDay: number;
  /** 白天段起始（日内分钟，含边界）。与策划「白天阈值」对齐；缺省 6:00。 */
  daytimeStartMinuteOfDay?: number;
  /**
   * 夜晚段起始（日内分钟，含边界）。与策划「夜晚阈值」对齐；缺省 18:00。
   * 当 daytimeStart < nighttimeStart 时，白天为 [daytimeStart, nighttimeStart)。
   */
  nighttimeStartMinuteOfDay?: number;
}>;

/** 与 `world-time` 快照的 `currentPeriod` 及行为侧时段语义一致。 */
export type DayNightPhase = "day" | "night";

export type DayNightPhaseTransition = "entered_day" | "entered_night";

export type TimeSpeed = 1 | 2 | 3;

export type TimeControlState = Readonly<{
  paused: boolean;
  speed: TimeSpeed;
}>;

const MINUTES_PER_DAY = 24 * 60;

/** 单帧真实时间步长上限（秒），避免 tab 挂起或调试断点后单 tick 推进过久。 */
export const MAX_FRAME_DT_SEC = 0.5;

export const DEFAULT_TIME_OF_DAY_CONFIG: TimeOfDayConfig = {
  realSecondsPerDay: 10 * 60,
  startMinuteOfDay: 6 * 60
};

export const DEFAULT_TIME_CONTROL_STATE: TimeControlState = {
  paused: false,
  speed: 1
};

/** 与 `timePeriodForMinute` / `detectTimeEvents` 共用，保证昼夜边界数值同源。 */
export function resolveDayNightThresholdMinutes(
  config: TimeOfDayConfig
): Readonly<{ daytimeStart: number; nighttimeStart: number }> {
  return {
    daytimeStart: config.daytimeStartMinuteOfDay ?? 6 * 60,
    nighttimeStart: config.nighttimeStartMinuteOfDay ?? 18 * 60
  };
}

function minuteToDayNightPhase(
  minuteOfDay: number,
  daytimeStart: number,
  nighttimeStart: number
): DayNightPhase {
  if (daytimeStart === nighttimeStart) {
    return "day";
  }
  if (daytimeStart < nighttimeStart) {
    return minuteOfDay >= daytimeStart && minuteOfDay < nighttimeStart ? "day" : "night";
  }
  return minuteOfDay >= daytimeStart || minuteOfDay < nighttimeStart ? "day" : "night";
}

/** 根据配置中的昼夜阈值判定当前是白天还是夜晚（先归一化日内分钟与跨日）。 */
export function getDayNightPhase(
  state: TimeOfDayState,
  config: TimeOfDayConfig = DEFAULT_TIME_OF_DAY_CONFIG
): DayNightPhase {
  const normalized = normalizeTimeState(state);
  const { daytimeStart, nighttimeStart } = resolveDayNightThresholdMinutes(config);
  return minuteToDayNightPhase(normalized.minuteOfDay, daytimeStart, nighttimeStart);
}

/**
 * 比较推进前后状态是否发生昼夜切换（供编排层在接入总线前做切换点识别）。
 * 不模拟区间内多次越界，仅比较两端相位的离散差分。
 */
export function diffDayNightPhaseTransition(
  previous: TimeOfDayState,
  next: TimeOfDayState,
  config: TimeOfDayConfig = DEFAULT_TIME_OF_DAY_CONFIG
): DayNightPhaseTransition | null {
  const prevPhase = getDayNightPhase(previous, config);
  const nextPhase = getDayNightPhase(next, config);
  if (prevPhase === nextPhase) {
    return null;
  }
  return nextPhase === "day" ? "entered_day" : "entered_night";
}

export function normalizeTimeState(state: TimeOfDayState): TimeOfDayState {
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
  if (controls.paused) return 0;
  const clampedReal = Math.min(Math.max(0, deltaSeconds), MAX_FRAME_DT_SEC);
  return clampedReal * controls.speed;
}

export function formatTimeOfDayLabel(state: TimeOfDayState): string {
  const normalized = normalizeTimeState(state);
  const totalMinutes = Math.floor(normalized.minuteOfDay);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `Day ${normalized.dayNumber} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
