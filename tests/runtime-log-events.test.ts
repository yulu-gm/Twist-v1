import { describe, expect, it } from "vitest";
import {
  createRuntimeLogEvent,
  formatRuntimeLogDetail,
  runtimeLogEventToPanelEntry,
  type RuntimeLogEvent
} from "../src/runtime-log/runtime-log";

describe("runtime log event", () => {
  function sampleEvent(overrides: Partial<RuntimeLogEvent> = {}): RuntimeLogEvent {
    return createRuntimeLogEvent({
      runId: "run-1",
      seq: 3,
      timestampIso: "2026-04-06T12:00:00.000Z",
      tick: 9,
      category: "AI.Decision",
      verbosity: "Log",
      message: "Alex selected eat",
      detail: {
        pawnId: "pawn-1",
        goal: "eat"
      },
      searchTextParts: ["Alex", "eat", "AI.Decision", "Log"],
      ...overrides
    });
  }

  it("normalizes search text from message, category, verbosity, and extra parts", () => {
    const event = sampleEvent();

    expect(event.searchText).toContain("alex");
    expect(event.searchText).toContain("ai.decision");
    expect(event.searchText).toContain("log");
    expect(event.searchText).toContain("eat");
  });

  it("builds a debug panel entry without losing event metadata in detail text", () => {
    const event = sampleEvent();

    const entry = runtimeLogEventToPanelEntry(event);

    expect(entry.id).toBe("run-1:3");
    expect(entry.tick).toBe(9);
    expect(entry.text).toBe("Alex selected eat");
    expect(entry.searchText).toBe(event.searchText);
    expect(entry.detailText).toContain('"category": "AI.Decision"');
    expect(entry.detailText).toContain('"goal": "eat"');
  });

  it("formats detail payloads as stable pretty json", () => {
    expect(formatRuntimeLogDetail({ foo: "bar", nested: { count: 2 } })).toContain('"count": 2');
  });
});
