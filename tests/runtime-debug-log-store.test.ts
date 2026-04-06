import { describe, expect, it } from "vitest";
import {
  createRuntimeDebugLogStore,
  type RuntimeDebugLogEventInput
} from "../src/ui/runtime-debug-log-store";
import { createRuntimeLogEvent } from "../src/runtime-log/runtime-log";

describe("runtime debug log store", () => {
  function entry(
    seq: number,
    category: string,
    message: string,
    extraSearchText: string
  ): RuntimeDebugLogEventInput {
    return createRuntimeLogEvent({
      runId: "run-1",
      seq,
      timestampIso: "2026-04-06T12:00:00.000Z",
      tick: seq,
      category,
      verbosity: "Log",
      message,
      detail: {
        message,
        extraSearchText
      },
      searchTextParts: [extraSearchText]
    });
  }

  it("filters by keyword across normalized search text", () => {
    const store = createRuntimeDebugLogStore({ limit: 5 });
    store.append(entry(1, "AI.Decision", "[tick 1] Alex goal-planner -> eat", "alex eat goal-planner"));
    store.append(entry(2, "Work.Lifecycle", "[tick 2] Bo work-released work-2", "bo work-released work-2"));

    expect(store.getVisibleEntries("released").map((item) => item.id)).toEqual(["run-1:2"]);
    expect(store.getVisibleEntries("alex").map((item) => item.id)).toEqual(["run-1:1"]);
  });

  it("keeps only the latest entries within the configured limit", () => {
    const store = createRuntimeDebugLogStore({ limit: 2 });
    store.append(entry(1, "System", "one", "one"));
    store.append(entry(2, "System", "two", "two"));
    store.append(entry(3, "System", "three", "three"));

    expect(store.getEvents().map((item) => item.seq)).toEqual([2, 3]);
    expect(store.getEntries().map((item) => item.id)).toEqual(["run-1:2", "run-1:3"]);
  });

  it("matches category and verbosity through the unified search text", () => {
    const store = createRuntimeDebugLogStore({ limit: 5 });
    store.append(
      createRuntimeLogEvent({
        runId: "run-1",
        seq: 1,
        timestampIso: "2026-04-06T12:00:00.000Z",
        tick: 1,
        category: "Scenario",
        verbosity: "Verbose",
        message: "scenario switched",
        detail: {
          scenario: "tree-harvest"
        },
        searchTextParts: ["tree-harvest"]
      })
    );

    expect(store.getVisibleEntries("scenario").map((item) => item.id)).toEqual(["run-1:1"]);
    expect(store.getVisibleEntries("verbose").map((item) => item.id)).toEqual(["run-1:1"]);
  });
});
