import type { RuntimeLogAsyncBatchSink } from "./runtime-log-session-logger";
import type { RuntimeLogEvent } from "./runtime-log";

const MAX_ERROR_BODY_CHARS = 512;

export type RuntimeLogDevHttpBatchSinkOptions = Readonly<{
  runId: string;
  endpoint: string;
  fetchImpl?: typeof fetch;
  /** 开发服 `POST …/start` 成功返回体中的 `filePath` / `runId` 回调（用于调试面板展示 NDJSON 落盘路径）。 */
  onStartAck?: (ack: Readonly<{ filePath?: string; runId?: string }>) => void;
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

async function readErrorBodySummary(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim();
    if (text.length === 0) {
      return "";
    }
    if (text.length <= MAX_ERROR_BODY_CHARS) {
      return text;
    }
    return `${text.slice(0, MAX_ERROR_BODY_CHARS)}…`;
  } catch {
    return "(无法读取响应体)";
  }
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
      const summary = await readErrorBodySummary(response as Response);
      const suffix = summary.length > 0 ? `: ${summary}` : "";
      throw new Error(`runtime-log-dev-client: request failed for ${path} (HTTP ${response.status})${suffix}`);
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
    }).then((body) => {
      options.onStartAck?.(body);
    });
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
