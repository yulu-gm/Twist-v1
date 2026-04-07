import { describe, expect, it, vi } from "vitest";
import {
  createRuntimeLogSessionLogger,
  createRuntimeLogStoreSink
} from "../src/runtime-log/runtime-log-session-logger";
import { createRuntimeLogEvent } from "../src/runtime-log/runtime-log";
import { createRuntimeDebugLogStore } from "../src/ui/runtime-debug-log-store";

describe("runtime log session logger", () => {
  function event(seq: number) {
    return createRuntimeLogEvent({
      runId: "run-1",
      seq,
      timestampIso: "2026-04-06T12:00:00.000Z",
      tick: seq,
      category: "AI.Decision",
      verbosity: "Log",
      message: `event-${seq}`,
      detail: { seq },
      searchTextParts: [`event-${seq}`]
    });
  }

  it("writes to the UI sink immediately while batching async file writes", async () => {
    vi.useFakeTimers();
    const store = createRuntimeDebugLogStore({ limit: 10 });
    const writeBatch = vi.fn<(events: readonly { seq: number }[]) => Promise<void>>(async () => undefined);
    const logger = createRuntimeLogSessionLogger({
      flushIntervalMs: 50,
      flushSize: 3,
      uiSink: createRuntimeLogStoreSink(store),
      asyncBatchSink: { writeBatch }
    });

    logger.log(event(1));
    logger.log(event(2));

    expect(store.getEntries().map((entry) => entry.text)).toEqual(["event-1", "event-2"]);
    expect(writeBatch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);

    expect(writeBatch).toHaveBeenCalledTimes(1);
    const firstBatch = writeBatch.mock.calls.at(0)?.[0];
    expect(firstBatch?.map((item: { seq: number }) => item.seq)).toEqual([1, 2]);
    vi.useRealTimers();
  });

  it("flushes immediately once the batch size threshold is reached", async () => {
    const writeBatch = vi.fn<(events: readonly { seq: number }[]) => Promise<void>>(async () => undefined);
    const logger = createRuntimeLogSessionLogger({
      flushIntervalMs: 500,
      flushSize: 2,
      asyncBatchSink: { writeBatch }
    });

    logger.log(event(1));
    logger.log(event(2));

    await Promise.resolve();

    expect(writeBatch).toHaveBeenCalledTimes(1);
    const firstBatch = writeBatch.mock.calls.at(0)?.[0];
    expect(firstBatch?.map((item: { seq: number }) => item.seq)).toEqual([1, 2]);
  });

  it("continues batching after a writeBatch rejection", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let calls = 0;
    const writeBatch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("sink-down");
      }
    });
    const logger = createRuntimeLogSessionLogger({
      flushIntervalMs: 500,
      flushSize: 1,
      asyncBatchSink: { writeBatch }
    });

    logger.log(event(1));
    logger.log(event(2));
    for (let i = 0; i < 20; i += 1) {
      await Promise.resolve();
    }

    expect(writeBatch).toHaveBeenCalledTimes(2);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("becomes a noop for file output when disabled", async () => {
    const writeBatch = vi.fn<(events: readonly { seq: number }[]) => Promise<void>>(async () => undefined);
    const logger = createRuntimeLogSessionLogger({
      enabled: false,
      flushIntervalMs: 10,
      flushSize: 1,
      asyncBatchSink: { writeBatch }
    });

    logger.log(event(1));
    await logger.flush();

    expect(writeBatch).not.toHaveBeenCalled();
  });
});
