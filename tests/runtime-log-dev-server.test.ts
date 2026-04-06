import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createRuntimeLogDevFileStore,
  shouldEnableRuntimeLogDevServer
} from "../src/runtime-log/runtime-log-dev-server";
import { createRuntimeLogEvent } from "../src/runtime-log/runtime-log";

describe("runtime log dev server", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("creates one ndjson file per run and appends batches to the same file", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "twist-runtime-log-"));
    tempDirs.push(rootDir);
    const store = createRuntimeLogDevFileStore({
      rootDir,
      now: () => new Date("2026-04-06T12:00:00.000Z"),
      randomId: () => "run-abc"
    });

    const run = await store.startRun();
    await store.writeBatch(
      run.runId,
      [
        createRuntimeLogEvent({
          runId: run.runId,
          seq: 1,
          timestampIso: "2026-04-06T12:00:00.000Z",
          tick: 1,
          category: "Runtime.Session",
          verbosity: "Display",
          message: "session start",
          detail: { phase: "start" }
        }),
        createRuntimeLogEvent({
          runId: run.runId,
          seq: 2,
          timestampIso: "2026-04-06T12:00:01.000Z",
          tick: 2,
          category: "AI.Decision",
          verbosity: "Log",
          message: "Alex selected eat",
          detail: { pawnId: "pawn-1" }
        })
      ]
    );
    await store.flushRun(run.runId);

    expect(run.filePath).toContain(path.join("logs", "dev"));
    expect(run.filePath.endsWith(".ndjson")).toBe(true);

    const lines = readFileSync(run.filePath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"category":"Runtime.Session"');
    expect(lines[1]).toContain('"message":"Alex selected eat"');
  });

  it("enables the dev server only for vite serve in development", () => {
    expect(shouldEnableRuntimeLogDevServer({ command: "serve", mode: "development", isRelease: false })).toBe(true);
    expect(shouldEnableRuntimeLogDevServer({ command: "build", mode: "development", isRelease: false })).toBe(false);
    expect(shouldEnableRuntimeLogDevServer({ command: "serve", mode: "production", isRelease: false })).toBe(false);
    expect(shouldEnableRuntimeLogDevServer({ command: "serve", mode: "development", isRelease: true })).toBe(false);
  });
});
