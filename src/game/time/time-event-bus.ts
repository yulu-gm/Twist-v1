import type { WorldTimeSnapshot } from "./world-time";

const MINUTES_PER_DAY = 24 * 60;
const DAY_START_MINUTE = 6 * 60;
const NIGHT_START_MINUTE = 18 * 60;

export type TimeEvent = Readonly<{
  kind: "day-start" | "night-start" | "new-day";
  dayNumber: number;
  minuteOfDay: number;
}>;

export type Unsubscribe = () => void;

export type TimeEventBus = Readonly<{
  readonly subscribers: Array<(event: TimeEvent) => void>;
}>;

function toAbsoluteMinutes(snapshot: WorldTimeSnapshot): number {
  return (snapshot.dayNumber - 1) * MINUTES_PER_DAY + snapshot.minuteOfDay;
}

/**
 * 比较两次世界时间快照，沿游戏时间单调前进方向（仅 next 严格晚于 prev）收集边界事件。
 *
 * - **new-day**：越过日历日界线（absolute 为 1440 的整数倍且 >0）时各发一次；`minuteOfDay` 固定为 0，表示新日始于 0:00。
 * - **day-start**：越过 6:00（进入白天段 [6:00, 18:00)），`minuteOfDay` 为 360。
 * - **night-start**：越过 18:00（进入夜），`minuteOfDay` 为 1080。
 *
 * 与 `world-time` 中 `timePeriodForMinute` / 快照的 `currentPeriod` 一致。起始时刻恰好落在边界上时不重复触发（左开右闭：prev 严格小于边界、next 可等于边界）。
 */
export function detectTimeEvents(
  prevTime: WorldTimeSnapshot,
  nextTime: WorldTimeSnapshot
): TimeEvent[] {
  const prevAbs = toAbsoluteMinutes(prevTime);
  const nextAbs = toAbsoluteMinutes(nextTime);
  if (nextAbs <= prevAbs) {
    return [];
  }

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

  const maxDayIndex = nextTime.dayNumber + 1;
  for (let dayNumber = 1; dayNumber <= maxDayIndex; dayNumber++) {
    const dayStartAbs = (dayNumber - 1) * MINUTES_PER_DAY + DAY_START_MINUTE;
    if (prevAbs < dayStartAbs && dayStartAbs <= nextAbs) {
      tagged.push({
        at: dayStartAbs,
        event: { kind: "day-start", dayNumber, minuteOfDay: DAY_START_MINUTE }
      });
    }
    const nightStartAbs = (dayNumber - 1) * MINUTES_PER_DAY + NIGHT_START_MINUTE;
    if (prevAbs < nightStartAbs && nightStartAbs <= nextAbs) {
      tagged.push({
        at: nightStartAbs,
        event: { kind: "night-start", dayNumber, minuteOfDay: NIGHT_START_MINUTE }
      });
    }
  }

  tagged.sort((a, b) => a.at - b.at);
  return tagged.map((t) => t.event);
}

export function createTimeEventBus(): TimeEventBus {
  const subscribers: Array<(event: TimeEvent) => void> = [];
  return { subscribers };
}

export function subscribe(
  bus: TimeEventBus,
  handler: (event: TimeEvent) => void
): Unsubscribe {
  bus.subscribers.push(handler);
  return () => {
    const i = bus.subscribers.indexOf(handler);
    if (i !== -1) {
      bus.subscribers.splice(i, 1);
    }
  };
}

/** 按事件顺序依次同步调用每个订阅者。 */
export function publish(bus: TimeEventBus, events: readonly TimeEvent[]): void {
  for (const event of events) {
    for (const handler of bus.subscribers) {
      handler(event);
    }
  }
}
