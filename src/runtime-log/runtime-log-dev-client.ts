import type { RuntimeLogAsyncBatchSink } from "./runtime-log-session-logger";
import type { RuntimeLogEvent } from "./runtime-log";

export type RuntimeLogDevHttpBatchSinkOptions = Readonly<{
  runId: string;
  endpoint: string;
  fetchImpl?: typeof fetch;
}>;

type RuntimeLogResponse = Readonly<{
  ok?: boolean;
  runId?: string;
  filePath?: string;
  error?: string;
}>;

async function readJson(response: Response | { json: () => Promise<RuntimeLogResponse> }): Promise<RuntimeLogResponse> {
  return response.json();
}

export function createRuntimeLogDevHttpBatchSink(
  options: RuntimeLogDevHttpBatchSinkOptions
): RuntimeLogAsyncBatchSink {
  const fetchImpl = options.fetchImpl ?? fetch;
  let startPromise: Promise<void> | null = null;

  const post = async (path: string, body: unknown): Promise<RuntimeLogResponse> => {
    const response = await fetchImpl(`${options.endpoint}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`runtime-log-dev-client: request failed for ${path}`);
    }
    return readJson(response as Response);
  };

  const ensureStarted = async (): Promise<void> => {
    if (startPromise) {
      return startPromise;
    }
    startPromise = post("/start", {
      action: "start",
      runId: options.runId
    }).then(() => undefined);
    return startPromise;
  };

  return {
    writeBatch: async (events: readonly RuntimeLogEvent[]) => {
      if (events.length === 0) {
        return;
      }
      await ensureStarted();
      await post("/batch", {
        action: "batch",
        runId: options.runId,
        events
      });
    },
    flush: async () => {
      await ensureStarted();
      await post("/flush", {
        action: "flush",
        runId: options.runId
      });
    }
  };
}
