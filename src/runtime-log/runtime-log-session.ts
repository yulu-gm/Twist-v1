import { createRuntimeDebugLogStore } from "../ui/runtime-debug-log-store";
import { createRuntimeLogDevHttpBatchSink } from "./runtime-log-dev-client";
import {
  createRuntimeLogSessionLogger,
  createRuntimeLogStoreSink,
  type RuntimeLogSessionLogger
} from "./runtime-log-session-logger";
import { createRuntimeLogEvent, type RuntimeLogCategory, type RuntimeLogDetail, type RuntimeLogEvent, type RuntimeLogVerbosity } from "./runtime-log";

declare const __TWIST_RUNTIME_LOG_DEV_SERVER__: boolean;

export type RuntimeLogSession = Readonly<{
  runId: string;
  store: ReturnType<typeof createRuntimeDebugLogStore>;
  logger: RuntimeLogSessionLogger;
  nextSeq: () => number;
  /** 开发服将运行时日志落盘为 NDJSON 时的绝对/工程内路径；仅 dev HTTP sink 启用且首次上报触发 `start` 成功后可用。 */
  devNdjsonFilePath: string | undefined;
  /** 当 `devNdjsonFilePath` 首次由开发服 `start` 响应写入时调用（用于刷新调试面板等）。 */
  setOnDevNdjsonPathReady: (callback: (() => void) | null) => void;
  createEvent: (input: Readonly<{
    category: RuntimeLogCategory;
    verbosity: RuntimeLogVerbosity;
    message: string;
    detail: RuntimeLogDetail;
    tick?: number;
    searchTextParts?: readonly (string | number | null | undefined)[];
  }>) => RuntimeLogEvent;
  log: (input: Readonly<{
    category: RuntimeLogCategory;
    verbosity: RuntimeLogVerbosity;
    message: string;
    detail: RuntimeLogDetail;
    tick?: number;
    searchTextParts?: readonly (string | number | null | undefined)[];
  }>) => RuntimeLogEvent;
  flush: () => Promise<void>;
}>;

const DEFAULT_LIMIT = 800;
const DEFAULT_FLUSH_SIZE = 20;
const DEFAULT_FLUSH_INTERVAL_MS = 200;
const FALLBACK_RUN_ID = `run-${Date.now().toString(36)}`;

let sessionSingleton: RuntimeLogSession | null = null;
let sequence = 0;

function createSession(): RuntimeLogSession {
  const runId = FALLBACK_RUN_ID;
  const store = createRuntimeDebugLogStore({ limit: DEFAULT_LIMIT });
  let devNdjsonFilePath: string | undefined;
  let onDevNdjsonPathReady: (() => void) | null = null;
  const asyncBatchSink =
    __TWIST_RUNTIME_LOG_DEV_SERVER__ === true
      ? createRuntimeLogDevHttpBatchSink({
          runId,
          endpoint: "/__runtime-log",
          onStartAck: (ack) => {
            if (ack.filePath) {
              devNdjsonFilePath = ack.filePath;
              onDevNdjsonPathReady?.();
            }
          }
        })
      : undefined;
  const logger = createRuntimeLogSessionLogger({
    enabled: __TWIST_RUNTIME_LOG_DEV_SERVER__ === true,
    flushIntervalMs: DEFAULT_FLUSH_INTERVAL_MS,
    flushSize: DEFAULT_FLUSH_SIZE,
    uiSink: createRuntimeLogStoreSink(store),
    asyncBatchSink
  });

  const nextSeq = (): number => {
    const value = sequence;
    sequence += 1;
    return value;
  };

  const createEvent = (input: Readonly<{
    category: RuntimeLogCategory;
    verbosity: RuntimeLogVerbosity;
    message: string;
    detail: RuntimeLogDetail;
    tick?: number;
    searchTextParts?: readonly (string | number | null | undefined)[];
  }>): RuntimeLogEvent =>
    createRuntimeLogEvent({
      runId,
      seq: nextSeq(),
      timestampIso: new Date().toISOString(),
      tick: input.tick,
      category: input.category,
      verbosity: input.verbosity,
      message: input.message,
      detail: input.detail,
      searchTextParts: input.searchTextParts
    });

  return {
    runId,
    store,
    logger,
    nextSeq,
    get devNdjsonFilePath(): string | undefined {
      return devNdjsonFilePath;
    },
    setOnDevNdjsonPathReady: (callback) => {
      onDevNdjsonPathReady = callback;
    },
    createEvent,
    log: (input) => {
      const event = createEvent(input);
      logger.log(event);
      return event;
    },
    flush: () => logger.flush()
  };
}

export function getRuntimeLogSession(): RuntimeLogSession {
  sessionSingleton ??= createSession();
  return sessionSingleton;
}
