import {
  runtimeLogEventToPanelEntry,
  type RuntimeLogEvent,
  type RuntimeLogPanelEntry
} from "../runtime-log/runtime-log";

export type RuntimeDebugLogEventInput = RuntimeLogEvent;
export type RuntimeDebugLogEvent = RuntimeLogEvent;
export type RuntimeDebugLogEntry = RuntimeLogPanelEntry;

export type RuntimeDebugLogStore = Readonly<{
  append: (entry: RuntimeDebugLogEventInput) => void;
  clear: () => void;
  getEntries: () => readonly RuntimeDebugLogEntry[];
  getEvents: () => readonly RuntimeDebugLogEvent[];
  getVisibleEntries: (keyword: string) => readonly RuntimeDebugLogEntry[];
}>;

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

export function selectRuntimeDebugLogEntries(
  events: readonly RuntimeDebugLogEvent[],
  keyword: string
): readonly RuntimeDebugLogEntry[] {
  const normalized = normalizeKeyword(keyword);
  const entries = events.map(runtimeLogEventToPanelEntry);
  if (normalized === "") {
    return entries;
  }
  return entries.filter((entry) => entry.searchText.toLowerCase().includes(normalized));
}

export function createRuntimeDebugLogStore(
  options: Readonly<{ limit: number }>
): RuntimeDebugLogStore {
  const limit = Math.max(1, options.limit);
  let events: RuntimeDebugLogEvent[] = [];

  return {
    append: (entry) => {
      events = [...events, entry].slice(-limit);
    },
    clear: () => {
      events = [];
    },
    getEntries: () => events.map(runtimeLogEventToPanelEntry),
    getEvents: () => events,
    getVisibleEntries: (keyword: string) => selectRuntimeDebugLogEntries(events, keyword)
  };
}
