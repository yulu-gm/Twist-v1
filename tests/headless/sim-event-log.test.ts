/**
 * refactor-test：事件采集器/快照基础设施回归，不绑定单一 scenario_id；与场景主验收正交。
 */
import { describe, expect, it } from "vitest";
import type { GridCoord } from "../../src/game/map/world-grid";
import {
  createDefaultPawnStates,
  setPawnIntent,
  type PawnState
} from "../../src/game/pawn-state";
import type { WorldTimeSnapshot } from "../../src/game/time/world-time";
import type { WorldSnapshot } from "../../src/game/world-core-types";
import { createHeadlessSim, createSimEventCollector } from "../../src/headless/index";

const MINIMAL_TIME: WorldTimeSnapshot = {
  dayNumber: 1,
  minuteOfDay: 0,
  dayProgress01: 0,
  currentPeriod: "day",
  paused: false,
  speed: 1
};

const MINIMAL_SNAPSHOT: WorldSnapshot = {
  time: MINIMAL_TIME,
  entities: [],
  occupancy: {},
  markers: [],
  workItems: [],
  restSpots: []
};

describe("createSimEventCollector", () => {
  it("records pawn-goal-changed with tick and pawn id", () => {
    const collector = createSimEventCollector();
    const spawn: readonly GridCoord[] = [{ col: 0, row: 0 }];
    const beforeList = createDefaultPawnStates(spawn, ["A"]);
    const before = beforeList[0]!;
    const goal = {
      kind: "sleep" as const,
      reason: "tired",
      targetId: "bed-1"
    };
    const after: PawnState = setPawnIntent(before, goal, undefined, undefined);
    collector.recordPawnDiff([before], [after], 7);
    const goals = collector.getEventsByKind("pawn-goal-changed");
    expect(goals).toHaveLength(1);
    const g = goals[0]!;
    expect(g.tick).toBe(7);
    expect(g.pawnId).toBe("pawn-0");
    expect(g.after?.kind).toBe("sleep");
    expect(collector.getEventsByPawn("pawn-0").length).toBeGreaterThanOrEqual(1);
    expect(collector.summary().byKind["pawn-goal-changed"]).toBe(1);
  });

  it("records work-created and work-claimed for newly claimed work", () => {
    const collector = createSimEventCollector();
    const before: WorldSnapshot = {
      ...MINIMAL_SNAPSHOT,
      workItems: []
    };
    const after: WorldSnapshot = {
      ...MINIMAL_SNAPSHOT,
      workItems: [
        {
          id: "w1",
          kind: "deconstruct-obstacle",
          anchorCell: { col: 1, row: 2 },
          targetEntityId: "e1",
          status: "claimed",
          claimedBy: "pawn-0",
          failureCount: 0
        }
      ]
    };
    collector.recordWorldDiff(before, after, 3);
    const created = collector.getEventsByKind("work-created");
    expect(created.map((e) => e.workItemId)).toEqual(["w1"]);
    const claimed = collector.getEventsByKind("work-claimed");
    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.claimedBy).toBe("pawn-0");
    expect(collector.getEventsByPawn("pawn-0").some((e) => e.kind === "work-claimed")).toBe(true);
  });

  it("emits night-start and day-start when the visible period changes", () => {
    const collector = createSimEventCollector();
    const beforeNight: WorldSnapshot = {
      ...MINIMAL_SNAPSHOT,
      time: {
        dayNumber: 1,
        minuteOfDay: 17 * 60 + 59,
        dayProgress01: (17 * 60 + 59) / (24 * 60),
        currentPeriod: "day",
        paused: false,
        speed: 1
      }
    };
    const atNight: WorldSnapshot = {
      ...MINIMAL_SNAPSHOT,
      time: {
        dayNumber: 1,
        minuteOfDay: 18 * 60,
        dayProgress01: (18 * 60) / (24 * 60),
        currentPeriod: "night",
        paused: false,
        speed: 1
      }
    };
    const atDay: WorldSnapshot = {
      ...MINIMAL_SNAPSHOT,
      time: {
        dayNumber: 2,
        minuteOfDay: 6 * 60,
        dayProgress01: (6 * 60) / (24 * 60),
        currentPeriod: "day",
        paused: false,
        speed: 1
      }
    };
    collector.recordWorldDiff(beforeNight, atNight, 1);
    collector.recordWorldDiff(atNight, atDay, 2);

    const night = collector.getEventsByKind("night-start");
    const day = collector.getEventsByKind("day-start");
    expect(night).toHaveLength(1);
    expect(day).toHaveLength(1);
    expect(night[0]!.minuteOfDay).toBe(18 * 60);
    expect(day[0]!.dayNumber).toBe(2);
    expect(collector.summary().byKind["night-start"]).toBe(1);
    expect(collector.summary().byKind["day-start"]).toBe(1);
  });

  it("clears recorded events", () => {
    const collector = createSimEventCollector();
    collector.recordPawnDiff([], [], 1);
    collector.clear();
    expect(collector.getEvents()).toHaveLength(0);
    expect(collector.summary().total).toBe(0);
  });

  it("integrates with createHeadlessSim and emits at least one interesting event after a tick", () => {
    const sim = createHeadlessSim({ seed: 42 });
    const collector = sim.getSimEventCollector();
    collector.clear();
    sim.spawnPawn("T", { col: 5, row: 5 });
    sim.tick(16);
    const kinds = new Set(sim.getSimEventCollector().getEvents().map((e) => e.kind));
    const interesting = [
      "pawn-moved",
      "pawn-motion-changed",
      "pawn-goal-changed",
      "pawn-action-changed",
      "pawn-need-changed",
      "work-created",
      "work-claimed",
      "work-completed",
      "entity-spawned",
      "entity-removed"
    ] as const;
    expect(interesting.some((kind) => kinds.has(kind))).toBe(true);
  });
});
