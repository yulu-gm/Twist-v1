import { describe, expect, it } from "vitest";
import {
  mapSimDebugTickToRuntimeLogEvents,
  type PawnDecisionTrace,
  type SimDebugTick,
  type WorkLifecycleTraceEvent
} from "../../src/headless/sim-debug-trace";

describe("sim debug trace runtime log mapping", () => {
  function createPawnDecision(): PawnDecisionTrace {
    return {
      pawnId: "pawn-1",
      pawnName: "Alex",
      decisionSource: "goal-planner",
      before: {
        logicalCell: { col: 1, row: 1 },
        needs: { hunger: 90, rest: 10, recreation: 5 },
        currentGoal: undefined,
        currentAction: undefined,
        activeWorkItemId: undefined,
        debugLabel: "goal:none action:idle"
      },
      after: {
        logicalCell: { col: 1, row: 1 },
        needs: { hunger: 90, rest: 10, recreation: 5 },
        currentGoal: { kind: "eat", reason: "hungry" },
        currentAction: { kind: "move-to-target", targetId: "eat-1" },
        activeWorkItemId: undefined,
        debugLabel: "goal:eat action:move"
      },
      candidates: [
        { goal: "eat", reason: "hungry", score: 10, targetId: "eat-1", targetAvailable: true }
      ],
      selectedCandidate: {
        goal: "eat",
        reason: "hungry",
        score: 10,
        targetId: "eat-1",
        targetAvailable: true
      },
      result: { kind: "move", step: { col: 2, row: 1 }, targetId: "eat-1" }
    };
  }

  function createWorkEvent(): WorkLifecycleTraceEvent {
    return {
      kind: "work-claimed",
      workItemId: "work-1",
      pawnId: "pawn-1",
      claimedBy: "pawn-1"
    };
  }

  it("maps pawn decisions and work lifecycle events into unified runtime log events", () => {
    const tick: SimDebugTick = {
      tick: 12,
      worldTime: {
        dayNumber: 1,
        minuteOfDay: 360,
        dayProgress01: 0.25,
        currentPeriod: "day",
        paused: false,
        speed: 1
      },
      pawnDecisions: [createPawnDecision()],
      workLifecycleEvents: [createWorkEvent()]
    };

    const events = mapSimDebugTickToRuntimeLogEvents({
      tick,
      runId: "run-1",
      seqStart: 5,
      timestampIso: "2026-04-06T12:00:00.000Z"
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      runId: "run-1",
      seq: 5,
      tick: 12,
      category: "AI.Decision",
      verbosity: "Log"
    });
    expect(events[0]?.message).toContain("Alex");
    expect(events[1]).toMatchObject({
      runId: "run-1",
      seq: 6,
      tick: 12,
      category: "Work.Lifecycle",
      verbosity: "Log"
    });
    expect(events[1]?.message).toContain("work-claimed");
    expect(events[1]?.searchText).toContain("work.lifecycle");
  });

  it("emits Work.Snapshot runtime log when tick carries work item snapshots", () => {
    const tick: SimDebugTick = {
      tick: 3,
      worldTime: {
        dayNumber: 1,
        minuteOfDay: 0,
        dayProgress01: 0,
        currentPeriod: "day",
        paused: false,
        speed: 1
      },
      pawnDecisions: [],
      workLifecycleEvents: [],
      workItems: [
        {
          id: "w-a",
          kind: "chop-tree",
          status: "open",
          anchorCell: { col: 0, row: 0 },
          failureCount: 0
        }
      ]
    };

    const events = mapSimDebugTickToRuntimeLogEvents({
      tick,
      runId: "run-snap",
      seqStart: 1,
      timestampIso: "2026-04-07T00:00:00.000Z"
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      category: "Work.Snapshot",
      verbosity: "Verbose",
      tick: 3
    });
    expect(events[0]?.message).toContain("work snapshot");
    expect(events[0]?.searchText).toContain("work.snapshot");
  });
});
