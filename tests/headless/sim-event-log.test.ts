import { describe, expect, it } from "vitest";
import type { WorldTimeSnapshot } from "../../src/game/time/world-time";
import type { WorldSnapshot } from "../../src/game/world-core-types";
import type { GridCoord } from "../../src/game/map/world-grid";
import {
  createDefaultPawnStates,
  setPawnIntent,
  type PawnState
} from "../../src/game/pawn-state";
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
  it("pawn-goal-changed：currentGoal 变化时记录 tick 与小人 id", () => {
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
    expect(g.kind).toBe("pawn-goal-changed");
    expect(g.tick).toBe(7);
    expect(g.pawnId).toBe("pawn-0");
    expect(g.after?.kind).toBe("sleep");
    expect(collector.getEventsByPawn("pawn-0").length).toBeGreaterThanOrEqual(1);
    expect(collector.summary().byKind["pawn-goal-changed"]).toBe(1);
  });

  it("work-created / work-claimed：新工单与认领过渡", () => {
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
    const c = claimed[0]!;
    expect(c.kind).toBe("work-claimed");
    expect(c.claimedBy).toBe("pawn-0");
    expect(collector.getEventsByPawn("pawn-0").some((e) => e.kind === "work-claimed")).toBe(true);
  });

  it("clear 后事件列表为空", () => {
    const collector = createSimEventCollector();
    collector.recordPawnDiff([], [], 1);
    collector.clear();
    expect(collector.getEvents()).toHaveLength(0);
    expect(collector.summary().total).toBe(0);
  });

  it("与 createHeadlessSim 集成：tick 产生至少一类小人或工单相关事件", () => {
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
    expect(interesting.some((k) => kinds.has(k))).toBe(true);
  });
});
