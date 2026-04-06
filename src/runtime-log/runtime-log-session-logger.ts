import type { RuntimeLogEvent } from "./runtime-log";
import type { RuntimeDebugLogStore } from "../ui/runtime-debug-log-store";

export type RuntimeLogUiSink = (event: RuntimeLogEvent) => void;

export type RuntimeLogAsyncBatchSink = Readonly<{
  writeBatch: (events: readonly RuntimeLogEvent[]) => Promise<void>;
  flush?: () => Promise<void>;
}>;

export type RuntimeLogSessionLogger = Readonly<{
  log: (event: RuntimeLogEvent) => void;
  logMany: (events: readonly RuntimeLogEvent[]) => void;
  flush: () => Promise<void>;
  dispose: () => Promise<void>;
}>;

export type CreateRuntimeLogSessionLoggerOptions = Readonly<{
  enabled?: boolean;
  flushIntervalMs: number;
  flushSize: number;
  uiSink?: RuntimeLogUiSink;
  asyncBatchSink?: RuntimeLogAsyncBatchSink;
}>;

export function createRuntimeLogStoreSink(store: RuntimeDebugLogStore): RuntimeLogUiSink {
  return (event) => store.append(event);
}

export function createRuntimeLogSessionLogger(
  options: CreateRuntimeLogSessionLoggerOptions
): RuntimeLogSessionLogger {
  const enabled = options.enabled !== false;
  const flushIntervalMs = Math.max(1, options.flushIntervalMs);
  const flushSize = Math.max(1, options.flushSize);
  const uiSink = options.uiSink;
  const asyncBatchSink = enabled ? options.asyncBatchSink : undefined;
  let pendingEvents: RuntimeLogEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let writeChain = Promise.resolve();

  const clearFlushTimer = (): void => {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  };

  const drainBatch = (): RuntimeLogEvent[] => {
    if (pendingEvents.length === 0) {
      return [];
    }
    const batch = pendingEvents;
    pendingEvents = [];
    clearFlushTimer();
    return batch;
  };

  const writeBatch = (events: readonly RuntimeLogEvent[]): Promise<void> => {
    if (!asyncBatchSink || events.length === 0) {
      return Promise.resolve();
    }
    writeChain = writeChain.then(() => asyncBatchSink.writeBatch(events));
    return writeChain;
  };

  const scheduleFlush = (): void => {
    if (!asyncBatchSink || flushTimer !== null || pendingEvents.length === 0) {
      return;
    }
    flushTimer = setTimeout(() => {
      void writeBatch(drainBatch());
    }, flushIntervalMs);
  };

  const log = (event: RuntimeLogEvent): void => {
    uiSink?.(event);
    if (!asyncBatchSink) {
      return;
    }
    pendingEvents.push(event);
    if (pendingEvents.length >= flushSize) {
      void writeBatch(drainBatch());
      return;
    }
    scheduleFlush();
  };

  return {
    log,
    logMany: (events) => {
      for (const event of events) {
        log(event);
      }
    },
    flush: async () => {
      await writeBatch(drainBatch());
      await asyncBatchSink?.flush?.();
    },
    dispose: async () => {
      clearFlushTimer();
      await writeBatch(drainBatch());
      await asyncBatchSink?.flush?.();
    }
  };
}
