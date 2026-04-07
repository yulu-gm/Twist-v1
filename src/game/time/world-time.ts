import {
  advanceTimeOfDay,
  DEFAULT_TIME_OF_DAY_CONFIG,
  effectiveSimulationDeltaSeconds,
  getDayNightPhase,
  type TimeControlState,
  type TimeOfDayConfig,
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

/** 与 {@link getDayNightPhase} 一致：阈值来自 `TimeOfDayConfig`（缺省仍为 [6:00, 18:00) 白天窗）。 */
export function timePeriodForMinute(
  minuteOfDay: number,
  timeConfig: TimeOfDayConfig = DEFAULT_TIME_OF_DAY_CONFIG
): TimePeriod {
  return getDayNightPhase({ dayNumber: 1, minuteOfDay }, timeConfig);
}

export function toWorldTimeSnapshot(
  state: TimeOfDayState,
  controls: TimeControlState,
  timeConfig: TimeOfDayConfig = DEFAULT_TIME_OF_DAY_CONFIG
): WorldTimeSnapshot {
  return {
    dayNumber: state.dayNumber,
    minuteOfDay: state.minuteOfDay,
    dayProgress01: state.minuteOfDay / (24 * 60),
    currentPeriod: getDayNightPhase(state, timeConfig),
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
): Readonly<{ world: WorldCore; elapsedSimulationSeconds: number }> {
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
      elapsedSimulationSeconds: 0
    };
  }

  const previousTime = world.time;
  const nextState = advanceTimeOfDay(
    toTimeOfDayState(previousTime),
    effectiveDeltaSeconds,
    world.timeConfig
  );
  const nextTime = toWorldTimeSnapshot(nextState, controls, world.timeConfig);

  return {
    world: {
      ...world,
      time: nextTime
    },
    elapsedSimulationSeconds: effectiveDeltaSeconds
  };
}
