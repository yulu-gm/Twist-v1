import type { TimePeriod, WorldTimeSnapshot } from "./world-time";
import {
  DEFAULT_TIME_OF_DAY_CONFIG,
  resolveDayNightThresholdMinutes,
  type TimeOfDayConfig
} from "./time-of-day";

const MINUTES_PER_DAY = 24 * 60;

export type TimeEvent = Readonly<
  | {
      kind: "day-start" | "night-start" | "new-day";
      dayNumber: number;
      minuteOfDay: number;
    }
  | {
      /** 与一次非零模拟推进对应的时间片落地（对齐设计「时间片推进」经总线分发）。 */
      kind: "time-advanced";
      dayNumber: number;
      minuteOfDay: number;
      currentPeriod: TimePeriod;
    }
>;

export type Unsubscribe = () => void;

const TIME_EVENT_BUS_BRAND = Symbol("TimeEventBus");

/** 不透明总线句柄；订阅列表仅保存在模块内 `WeakMap` 中，禁止外部直接改订阅数组。 */
export type TimeEventBus = Readonly<{ [TIME_EVENT_BUS_BRAND]: true }>;

const subscribersByBus = new WeakMap<TimeEventBus, Array<(event: TimeEvent) => void>>();

function subscribersFor(bus: TimeEventBus): Array<(event: TimeEvent) => void> {
  const list = subscribersByBus.get(bus);
  if (!list) {
    throw new Error("Invalid TimeEventBus instance");
  }
  return list;
}

function toAbsoluteMinutes(snapshot: WorldTimeSnapshot): number {
  return (snapshot.dayNumber - 1) * MINUTES_PER_DAY + snapshot.minuteOfDay;
}

/**
 * 比较两次世界时间快照，沿游戏时间单调前进方向（仅 next 严格晚于 prev）收集边界事件。
 *
 * - **new-day**：越过日历日界线（absolute 为 1440 的整数倍且 >0）时各发一次；`minuteOfDay` 固定为 0，表示新日始于 0:00。
 * - **day-start**：越过配置的白天起点（默认 6:00，与 `TimeOfDayConfig.daytimeStartMinuteOfDay` 一致）。
 * - **night-start**：越过配置的夜晚起点（默认 18:00）。
 *
 * 阈值由 `resolveDayNightThresholdMinutes(timeConfig)` 解析，与 `world-time` 中 `timePeriodForMinute` / 快照的 `currentPeriod` 同源。若两阈值相等则 `getDayNightPhase` 恒为白天，本函数不发出昼夜边界事件。起始时刻恰好落在边界上时不重复触发（左开右闭：prev 严格小于边界、next 可等于边界）。
 */
export function detectTimeEvents(
  prevTime: WorldTimeSnapshot,
  nextTime: WorldTimeSnapshot,
  timeConfig: TimeOfDayConfig = DEFAULT_TIME_OF_DAY_CONFIG
): TimeEvent[] {
  const prevAbs = toAbsoluteMinutes(prevTime);
  const nextAbs = toAbsoluteMinutes(nextTime);
  if (nextAbs <= prevAbs) {
    return [];
  }

  const { daytimeStart, nighttimeStart } = resolveDayNightThresholdMinutes(timeConfig);

  type Tagged = Readonly<{ at: number; event: TimeEvent }>;
  const tagged: Tagged[] = [];

  for (let boundary = MINUTES_PER_DAY; boundary <= nextAbs; boundary += MINUTES_PER_DAY) {
    if (prevAbs < boundary) {
      tagged.push({
        at: boundary,
        event: {
          kind: "new-day",
          dayNumber: boundary / MINUTES_PER_DAY + 1,
          minuteOfDay: 0
        }
      });
    }
  }

  if (daytimeStart !== nighttimeStart) {
    const maxDayIndex = nextTime.dayNumber + 1;
    for (let dayNumber = 1; dayNumber <= maxDayIndex; dayNumber++) {
      const dayStartAbs = (dayNumber - 1) * MINUTES_PER_DAY + daytimeStart;
      if (prevAbs < dayStartAbs && dayStartAbs <= nextAbs) {
        tagged.push({
          at: dayStartAbs,
          event: { kind: "day-start", dayNumber, minuteOfDay: daytimeStart }
        });
      }
      const nightStartAbs = (dayNumber - 1) * MINUTES_PER_DAY + nighttimeStart;
      if (prevAbs < nightStartAbs && nightStartAbs <= nextAbs) {
        tagged.push({
          at: nightStartAbs,
          event: { kind: "night-start", dayNumber, minuteOfDay: nighttimeStart }
        });
      }
    }
  }

  tagged.sort((a, b) => a.at - b.at);
  return tagged.map((t) => t.event);
}

/** 编排层在 `advanceWorldClock` 产生非零 `elapsedSimulationSeconds` 后调用，投递本 tick 时间片结果。 */
export function timeSliceAdvancedEvent(snapshot: WorldTimeSnapshot): TimeEvent {
  return {
    kind: "time-advanced",
    dayNumber: snapshot.dayNumber,
    minuteOfDay: snapshot.minuteOfDay,
    currentPeriod: snapshot.currentPeriod
  };
}

export function createTimeEventBus(): TimeEventBus {
  const bus = { [TIME_EVENT_BUS_BRAND]: true } as TimeEventBus;
  subscribersByBus.set(bus, []);
  return bus;
}

export function subscribe(
  bus: TimeEventBus,
  handler: (event: TimeEvent) => void
): Unsubscribe {
  const subscribers = subscribersFor(bus);
  subscribers.push(handler);
  return () => {
    const i = subscribers.indexOf(handler);
    if (i !== -1) {
      subscribers.splice(i, 1);
    }
  };
}

/** 按事件顺序依次同步调用每个订阅者。 */
export function publish(bus: TimeEventBus, events: readonly TimeEvent[]): void {
  const subscribers = subscribersFor(bus);
  for (const event of events) {
    for (const handler of subscribers) {
      handler(event);
    }
  }
}
