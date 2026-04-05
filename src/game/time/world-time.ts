import {
  advanceTimeOfDay,
  effectiveSimulationDeltaSeconds,
  type TimeControlState,
  type TimeOfDayState
} from "./time-of-day";
import type { WorldCore } from "../world-core";

export type TimePeriod = "day" | "night";

export type WorldTimeSnapshot = Readonly<{
  dayNumber: number;
  minuteOfDay: number;
  dayProgress01: number;
  currentPeriod: TimePeriod;
  paused: boolean;
  speed: TimeControlState["speed"];
}>;

export type WorldTimeEvent =
  | Readonly<{
      kind: "time-advanced";
      dayNumber: number;
      minuteOfDay: number;
      currentPeriod: TimePeriod;
    }>
  | Readonly<{
      kind: "period-changed";
      dayNumber: number;
      period: TimePeriod;
    }>
  | Readonly<{
      kind: "day-changed";
      dayNumber: number;
    }>;

/** 与日内分钟数一致的时段判定：白天 [6:00, 18:00)，其余为夜。 */
export function timePeriodForMinute(minuteOfDay: number): TimePeriod {
  return minuteOfDay >= 6 * 60 && minuteOfDay < 18 * 60 ? "day" : "night";
}

export function toWorldTimeSnapshot(
  state: TimeOfDayState,
  controls: TimeControlState
): WorldTimeSnapshot {
  return {
    dayNumber: state.dayNumber,
    minuteOfDay: state.minuteOfDay,
    dayProgress01: state.minuteOfDay / (24 * 60),
    currentPeriod: timePeriodForMinute(state.minuteOfDay),
    paused: controls.paused,
    speed: controls.speed
  };
}

function toTimeOfDayState(snapshot: WorldTimeSnapshot): TimeOfDayState {
  return {
    dayNumber: snapshot.dayNumber,
    minuteOfDay: snapshot.minuteOfDay
  };
}

export function advanceWorldClock(
  world: WorldCore,
  deltaSeconds: number,
  controls: TimeControlState
): Readonly<{ world: WorldCore; elapsedSimulationSeconds: number; events: readonly WorldTimeEvent[] }> {
  const effectiveDeltaSeconds = effectiveSimulationDeltaSeconds(deltaSeconds, controls);
  if (effectiveDeltaSeconds === 0) {
    return {
      world: {
        ...world,
        time: {
          ...world.time,
          paused: controls.paused,
          speed: controls.speed
        }
      },
      elapsedSimulationSeconds: 0,
      events: []
    };
  }

  const previousTime = world.time;
  const nextState = advanceTimeOfDay(
    toTimeOfDayState(previousTime),
    effectiveDeltaSeconds,
    world.timeConfig
  );
  const nextTime = toWorldTimeSnapshot(nextState, controls);
  const events: WorldTimeEvent[] = [
    {
      kind: "time-advanced",
      dayNumber: nextTime.dayNumber,
      minuteOfDay: nextTime.minuteOfDay,
      currentPeriod: nextTime.currentPeriod
    }
  ];

  if (previousTime.dayNumber !== nextTime.dayNumber || previousTime.currentPeriod !== nextTime.currentPeriod) {
    events.push({
      kind: "period-changed",
      dayNumber: nextTime.dayNumber,
      period: nextTime.currentPeriod
    });
  }

  if (nextTime.dayNumber !== previousTime.dayNumber) {
    for (let dayNumber = previousTime.dayNumber + 1; dayNumber <= nextTime.dayNumber; dayNumber++) {
      events.push({
        kind: "day-changed",
        dayNumber
      });
    }
  }

  return {
    world: {
      ...world,
      time: nextTime
    },
    elapsedSimulationSeconds: effectiveDeltaSeconds,
    events
  };
}
