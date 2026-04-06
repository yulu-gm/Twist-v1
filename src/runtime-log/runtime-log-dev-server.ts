import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";
import type { RuntimeLogEvent } from "./runtime-log";

export type RuntimeLogDevRun = Readonly<{
  runId: string;
  filePath: string;
}>;

export type RuntimeLogDevFileStore = Readonly<{
  startRun: (runId?: string) => Promise<RuntimeLogDevRun>;
  writeBatch: (runId: string, events: readonly RuntimeLogEvent[]) => Promise<void>;
  flushRun: (runId: string) => Promise<void>;
}>;

export type ShouldEnableRuntimeLogDevServerInput = Readonly<{
  command: "serve" | "build";
  mode: string;
  isRelease: boolean;
}>;

export type CreateRuntimeLogDevFileStoreOptions = Readonly<{
  rootDir: string;
  now?: () => Date;
  randomId?: () => string;
}>;

type RuntimeLogDevFileState = {
  filePath: string;
  writeChain: Promise<void>;
};

function formatTimestampForFile(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function createRunId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function shouldEnableRuntimeLogDevServer(
  input: ShouldEnableRuntimeLogDevServerInput
): boolean {
  return input.command === "serve" && input.mode === "development" && input.isRelease === false;
}

export function createRuntimeLogDevFileStore(
  options: CreateRuntimeLogDevFileStoreOptions
): RuntimeLogDevFileStore {
  const now = options.now ?? (() => new Date());
  const randomId = options.randomId ?? createRunId;
  const runs = new Map<string, RuntimeLogDevFileState>();

  return {
    startRun: async (requestedRunId) => {
      const runId = requestedRunId ?? randomId();
      const logsDir = path.join(options.rootDir, "logs", "dev");
      await mkdir(logsDir, { recursive: true });
      const filePath = path.join(logsDir, `${formatTimestampForFile(now())}-${runId}.ndjson`);
      runs.set(runId, {
        filePath,
        writeChain: Promise.resolve()
      });
      return { runId, filePath };
    },
    writeBatch: async (runId, events) => {
      if (events.length === 0) {
        return;
      }
      const state = runs.get(runId);
      if (!state) {
        throw new Error(`runtime-log-dev-server: unknown run id ${runId}`);
      }
      const payload = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
      state.writeChain = state.writeChain.then(() => appendFile(state.filePath, payload, "utf8"));
      await state.writeChain;
    },
    flushRun: async (runId) => {
      const state = runs.get(runId);
      await state?.writeChain;
    }
  };
}

type RuntimeLogDevRequest =
  | Readonly<{ action: "start"; runId?: string }>
  | Readonly<{ action: "batch"; runId: string; events: readonly RuntimeLogEvent[] }>
  | Readonly<{ action: "flush"; runId: string }>;

async function readJsonBody(request: IncomingMessage): Promise<RuntimeLogDevRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length > 0 ? (JSON.parse(raw) as RuntimeLogDevRequest) : { action: "start" };
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

export function createRuntimeLogDevMiddleware(
  store: RuntimeLogDevFileStore
): Connect.NextHandleFunction {
  return async (request, response, next) => {
    if (!request.url?.startsWith("/__runtime-log/")) {
      next();
      return;
    }
    if (request.method !== "POST") {
      writeJson(response, 405, { error: "method-not-allowed" });
      return;
    }

    try {
      const payload = await readJsonBody(request);
      if (payload.action === "start") {
        writeJson(response, 200, await store.startRun(payload.runId));
        return;
      }
      if (payload.action === "batch") {
        await store.writeBatch(payload.runId, payload.events);
        writeJson(response, 200, { ok: true });
        return;
      }
      await store.flushRun(payload.runId);
      writeJson(response, 200, { ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(response, 500, { error: message });
    }
  };
}
