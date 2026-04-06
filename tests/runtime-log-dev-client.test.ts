import { describe, expect, it, vi } from "vitest";
import { createRuntimeLogDevHttpBatchSink } from "../src/runtime-log/runtime-log-dev-client";
import { createRuntimeLogEvent } from "../src/runtime-log/runtime-log";

describe("runtime log dev http batch sink", () => {
  it("starts the run once and reuses the same run id for batch and flush requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ runId: "run-1", filePath: "/tmp/logs/dev/file.ndjson" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      });

    const sink = createRuntimeLogDevHttpBatchSink({
      runId: "run-1",
      endpoint: "/__runtime-log",
      fetchImpl: fetchMock
    });

    await sink.writeBatch([
      createRuntimeLogEvent({
        runId: "run-1",
        seq: 1,
        timestampIso: "2026-04-06T12:00:00.000Z",
        tick: 1,
        category: "Runtime.Session",
        verbosity: "Display",
        message: "session start",
        detail: { ok: true }
      })
    ]);
    await sink.flush?.();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/__runtime-log/start");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/__runtime-log/batch");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/__runtime-log/flush");
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"runId":"run-1"');
  });
});
