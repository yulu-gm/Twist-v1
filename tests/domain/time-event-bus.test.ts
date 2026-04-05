import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIME_CONTROL_STATE,
  createTimeEventBus,
  detectTimeEvents,
  publish,
  subscribe,
  toWorldTimeSnapshot,
  type TimeEvent,
  type TimeOfDayState
} from "../../src/game/time";

function snapshot(state: TimeOfDayState) {
  return toWorldTimeSnapshot(state, DEFAULT_TIME_CONTROL_STATE);
}

describe("detectTimeEvents", () => {
  it("进入白天时发出 day-start", () => {
    const prev = snapshot({ dayNumber: 1, minuteOfDay: 5 * 60 + 59 });
    const next = snapshot({ dayNumber: 1, minuteOfDay: 6 * 60 });
    expect(detectTimeEvents(prev, next)).toEqual<TimeEvent[]>([
      { kind: "day-start", dayNumber: 1, minuteOfDay: 6 * 60 }
    ]);
  });

  it("进入夜晚时发出 night-start", () => {
    const prev = snapshot({ dayNumber: 1, minuteOfDay: 17 * 60 + 59 });
    const next = snapshot({ dayNumber: 1, minuteOfDay: 18 * 60 });
    expect(detectTimeEvents(prev, next)).toEqual<TimeEvent[]>([
      { kind: "night-start", dayNumber: 1, minuteOfDay: 18 * 60 }
    ]);
  });

  it("同一步内先越过黄昏再跨日时顺序为 night-start、new-day", () => {
    const prev = snapshot({ dayNumber: 1, minuteOfDay: 17 * 60 });
    const next = snapshot({ dayNumber: 2, minuteOfDay: 1 });
    expect(detectTimeEvents(prev, next)).toEqual<TimeEvent[]>([
      { kind: "night-start", dayNumber: 1, minuteOfDay: 18 * 60 },
      { kind: "new-day", dayNumber: 2, minuteOfDay: 0 }
    ]);
  });

  it("跨天后再过早晨 6 点：new-day 早于 day-start", () => {
    const prev = snapshot({ dayNumber: 1, minuteOfDay: 23 * 60 });
    const next = snapshot({ dayNumber: 2, minuteOfDay: 7 * 60 });
    expect(detectTimeEvents(prev, next)).toEqual<TimeEvent[]>([
      { kind: "new-day", dayNumber: 2, minuteOfDay: 0 },
      { kind: "day-start", dayNumber: 2, minuteOfDay: 6 * 60 }
    ]);
  });

  it("同一日内既有日切又有夜切时按时间先后排列", () => {
    const prev = snapshot({ dayNumber: 1, minuteOfDay: 5 * 60 });
    const next = snapshot({ dayNumber: 1, minuteOfDay: 19 * 60 });
    expect(detectTimeEvents(prev, next)).toEqual<TimeEvent[]>([
      { kind: "day-start", dayNumber: 1, minuteOfDay: 6 * 60 },
      { kind: "night-start", dayNumber: 1, minuteOfDay: 18 * 60 }
    ]);
  });

  it("连续跨越多天时每道日界线各发一次 new-day，并包含中间各日的昼夜切", () => {
    const prev = snapshot({ dayNumber: 1, minuteOfDay: 23 * 60 });
    const next = snapshot({ dayNumber: 4, minuteOfDay: 1 });
    expect(detectTimeEvents(prev, next)).toEqual<TimeEvent[]>([
      { kind: "new-day", dayNumber: 2, minuteOfDay: 0 },
      { kind: "day-start", dayNumber: 2, minuteOfDay: 6 * 60 },
      { kind: "night-start", dayNumber: 2, minuteOfDay: 18 * 60 },
      { kind: "new-day", dayNumber: 3, minuteOfDay: 0 },
      { kind: "day-start", dayNumber: 3, minuteOfDay: 6 * 60 },
      { kind: "night-start", dayNumber: 3, minuteOfDay: 18 * 60 },
      { kind: "new-day", dayNumber: 4, minuteOfDay: 0 }
    ]);
  });

  it("恰好停在边界上时不重复触发 day-start", () => {
    const atSix = snapshot({ dayNumber: 1, minuteOfDay: 6 * 60 });
    const later = snapshot({ dayNumber: 1, minuteOfDay: 6 * 60 + 30 });
    expect(detectTimeEvents(atSix, later)).toEqual([]);
  });

  it("时间不前进或倒退时不产生事件", () => {
    const t = snapshot({ dayNumber: 2, minuteOfDay: 12 * 60 });
    expect(detectTimeEvents(t, t)).toEqual([]);
    expect(detectTimeEvents(snapshot({ dayNumber: 2, minuteOfDay: 400 }), snapshot({ dayNumber: 1, minuteOfDay: 500 }))).toEqual(
      []
    );
  });
});

describe("TimeEventBus", () => {
  it("publish 按顺序将事件推给订阅者", () => {
    const bus = createTimeEventBus();
    const received: TimeEvent[] = [];
    subscribe(bus, (e) => received.push(e));

    const prev = snapshot({ dayNumber: 1, minuteOfDay: 5 * 60 });
    const next = snapshot({ dayNumber: 1, minuteOfDay: 19 * 60 });
    const events = detectTimeEvents(prev, next);
    publish(bus, events);

    expect(received).toEqual(events);
  });

  it("多个订阅者各收到全部事件", () => {
    const bus = createTimeEventBus();
    const a: TimeEvent[] = [];
    const b: TimeEvent[] = [];
    subscribe(bus, (e) => a.push(e));
    subscribe(bus, (e) => b.push(e));

    const prev = snapshot({ dayNumber: 1, minuteOfDay: 23 * 60 });
    const next = snapshot({ dayNumber: 2, minuteOfDay: 7 * 60 });
    const events = detectTimeEvents(prev, next);
    publish(bus, events);

    expect(a).toEqual(events);
    expect(b).toEqual(events);
  });

  it("unsubscribe 后不再收到事件", () => {
    const bus = createTimeEventBus();
    const received: TimeEvent[] = [];
    const off = subscribe(bus, (e) => received.push(e));
    off();

    publish(bus, [{ kind: "day-start", dayNumber: 1, minuteOfDay: 360 }]);
    expect(received).toEqual([]);
  });
});
