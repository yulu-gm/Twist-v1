export type RuntimeLogVerbosity =
  | "Error"
  | "Warning"
  | "Display"
  | "Log"
  | "Verbose"
  | "VeryVerbose";

export type RuntimeLogCategory =
  | "AI.Decision"
  | "Work.Lifecycle"
  | "Runtime.Session"
  | "Scenario"
  | "System"
  | (string & {});

export type RuntimeLogDetail = Readonly<Record<string, unknown>> | readonly unknown[] | string | number | boolean | null;

export type RuntimeLogEventInput = Readonly<{
  runId: string;
  seq: number;
  timestampIso: string;
  tick?: number;
  category: RuntimeLogCategory;
  verbosity: RuntimeLogVerbosity;
  message: string;
  detail: RuntimeLogDetail;
  searchTextParts?: readonly (string | number | null | undefined)[];
}>;

export type RuntimeLogEvent = Readonly<{
  runId: string;
  seq: number;
  timestampIso: string;
  tick?: number;
  category: RuntimeLogCategory;
  verbosity: RuntimeLogVerbosity;
  message: string;
  detail: RuntimeLogDetail;
  searchText: string;
}>;

export type RuntimeLogPanelEntry = Readonly<{
  id: string;
  tick: number;
  text: string;
  searchText: string;
  detailText: string;
}>;

function normalizeSearchToken(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim().toLowerCase();
}

function buildSearchText(input: RuntimeLogEventInput): string {
  const values = [
    input.message,
    input.category,
    input.verbosity,
    ...(input.searchTextParts ?? [])
  ];
  return values
    .map(normalizeSearchToken)
    .filter((value) => value.length > 0)
    .join(" ");
}

export function createRuntimeLogEvent(input: RuntimeLogEventInput): RuntimeLogEvent {
  return {
    runId: input.runId,
    seq: input.seq,
    timestampIso: input.timestampIso,
    tick: input.tick,
    category: input.category,
    verbosity: input.verbosity,
    message: input.message,
    detail: input.detail,
    searchText: buildSearchText(input)
  };
}

export function formatRuntimeLogDetail(detail: RuntimeLogDetail): string {
  if (typeof detail === "string") {
    return detail;
  }
  return JSON.stringify(detail, null, 2);
}

export function runtimeLogEventToPanelEntry(event: RuntimeLogEvent): RuntimeLogPanelEntry {
  return {
    id: `${event.runId}:${event.seq}`,
    tick: event.tick ?? -1,
    text: event.message,
    searchText: event.searchText,
    detailText: JSON.stringify(
      {
        runId: event.runId,
        seq: event.seq,
        timestampIso: event.timestampIso,
        tick: event.tick,
        category: event.category,
        verbosity: event.verbosity,
        message: event.message,
        detail: event.detail
      },
      null,
      2
    )
  };
}
