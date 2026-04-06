import type { GoalDecisionCandidate } from "../game/behavior/goal-driven-planning";
import type { GridCoord } from "../game/map/world-grid";
import type { PawnActionState, PawnGoalState, PawnState } from "../game/pawn-state";
import type { WorldSnapshot } from "../game/world-core-types";
import type { WorkItemSnapshot } from "../game/work/work-types";
import type { WorldTimeSnapshot } from "../game/time/world-time";
import { createRuntimeLogEvent, type RuntimeLogEvent } from "../runtime-log/runtime-log";

export type HeadlessDebugTraceOptions = Readonly<{
  enabled?: boolean;
  emitConsoleSummary?: boolean;
  snapshotWorkItemsEachTick?: boolean;
}>;

export type WorkItemTraceSnapshot = Readonly<{
  id: string;
  kind: WorkItemSnapshot["kind"];
  status: WorkItemSnapshot["status"];
  claimedBy?: string;
  targetEntityId?: string;
  anchorCell: GridCoord;
  failureCount: number;
  derivedFromWorkId?: string;
  haulTargetZoneId?: string;
  haulDropCell?: GridCoord;
}>;

export type WorkLifecycleTraceEventKind =
  | "work-created"
  | "work-claimed"
  | "work-released"
  | "work-completed"
  | "work-failed"
  | "work-derived";

export type WorkLifecycleTraceEvent = Readonly<{
  kind: WorkLifecycleTraceEventKind;
  workItemId: string;
  pawnId?: string;
  claimedBy?: string;
  derivedFromWorkId?: string;
  failureCount?: number;
  reason?: string;
}>;

export type PawnDecisionTraceState = Readonly<{
  logicalCell: GridCoord;
  needs: PawnState["needs"];
  currentGoal: PawnGoalState | undefined;
  currentAction: PawnActionState | undefined;
  activeWorkItemId?: string;
  debugLabel: string;
}>;

export type PawnDecisionResult = Readonly<{
  kind: "move" | "use-target" | "idle" | "blocked";
  targetId?: string;
  step?: GridCoord;
  blockedReason?: "reservation-failed" | "step-blocked" | "step-conflict" | "target-missing";
}>;

export type PawnDecisionTrace = Readonly<{
  pawnId: string;
  pawnName: string;
  decisionSource: "claimed-work-anchor" | "goal-planner" | "continue-current" | "need-interrupt";
  before: PawnDecisionTraceState;
  after: PawnDecisionTraceState;
  candidates: readonly GoalDecisionCandidate[];
  selectedCandidate?: GoalDecisionCandidate;
  result: PawnDecisionResult;
  interruptReason?: string;
}>;

export type SimDebugTick = Readonly<{
  tick: number;
  worldTime: WorldTimeSnapshot;
  workItems?: readonly WorkItemTraceSnapshot[];
  workLifecycleEvents: readonly WorkLifecycleTraceEvent[];
  pawnDecisions: readonly PawnDecisionTrace[];
}>;

export type SimDebugTrace = Readonly<{
  enabled: boolean;
  ticks: readonly SimDebugTick[];
}>;

export type MapSimDebugTickToRuntimeLogEventsInput = Readonly<{
  tick: SimDebugTick;
  runId: string;
  seqStart: number;
  timestampIso: string;
}>;

export function createEmptySimDebugTrace(enabled: boolean = false): SimDebugTrace {
  return {
    enabled,
    ticks: []
  };
}

export function clonePawnDecisionState(pawn: PawnState): PawnDecisionTraceState {
  return {
    logicalCell: { col: pawn.logicalCell.col, row: pawn.logicalCell.row },
    needs: {
      hunger: pawn.needs.hunger,
      rest: pawn.needs.rest,
      recreation: pawn.needs.recreation
    },
    currentGoal: pawn.currentGoal ? { ...pawn.currentGoal } : undefined,
    currentAction: pawn.currentAction ? { ...pawn.currentAction } : undefined,
    activeWorkItemId: pawn.activeWorkItemId,
    debugLabel: pawn.debugLabel
  };
}

export function snapshotWorkItem(workItem: WorkItemSnapshot): WorkItemTraceSnapshot {
  return {
    id: workItem.id,
    kind: workItem.kind,
    status: workItem.status,
    claimedBy: workItem.claimedBy,
    targetEntityId: workItem.targetEntityId,
    anchorCell: { col: workItem.anchorCell.col, row: workItem.anchorCell.row },
    failureCount: workItem.failureCount,
    derivedFromWorkId: workItem.derivedFromWorkId,
    haulTargetZoneId: workItem.haulTargetZoneId,
    haulDropCell: workItem.haulDropCell
      ? { col: workItem.haulDropCell.col, row: workItem.haulDropCell.row }
      : undefined
  };
}

export function snapshotWorkItems(workItems: Iterable<WorkItemSnapshot>): readonly WorkItemTraceSnapshot[] {
  return [...workItems].map(snapshotWorkItem);
}

function unionWorkIds(before: readonly WorkItemSnapshot[], after: readonly WorkItemSnapshot[]): string[] {
  const ids = new Set<string>();
  for (const work of before) ids.add(work.id);
  for (const work of after) ids.add(work.id);
  return [...ids].sort();
}

export function diffWorkLifecycleEvents(
  before: WorldSnapshot,
  after: WorldSnapshot
): readonly WorkLifecycleTraceEvent[] {
  const events: WorkLifecycleTraceEvent[] = [];
  const beforeMap = new Map(before.workItems.map((work) => [work.id, work]));
  const afterMap = new Map(after.workItems.map((work) => [work.id, work]));

  for (const id of unionWorkIds(before.workItems, after.workItems)) {
    const prev = beforeMap.get(id);
    const next = afterMap.get(id);

    if (!prev && next) {
      events.push({
        kind: "work-created",
        workItemId: id
      });
      if (next.derivedFromWorkId) {
        events.push({
          kind: "work-derived",
          workItemId: id,
          derivedFromWorkId: next.derivedFromWorkId
        });
      }
      if (next.status === "claimed" || next.claimedBy) {
        events.push({
          kind: "work-claimed",
          workItemId: id,
          claimedBy: next.claimedBy,
          pawnId: next.claimedBy
        });
      }
      if (next.status === "completed") {
        events.push({
          kind: "work-completed",
          workItemId: id,
          claimedBy: next.claimedBy,
          pawnId: next.claimedBy
        });
      }
      continue;
    }

    if (!prev || !next) continue;

    const wasClaimed = prev.status === "claimed" || Boolean(prev.claimedBy);
    const isClaimed = next.status === "claimed" || Boolean(next.claimedBy);
    if (!wasClaimed && isClaimed) {
      events.push({
        kind: "work-claimed",
        workItemId: id,
        claimedBy: next.claimedBy,
        pawnId: next.claimedBy
      });
    }
    if (wasClaimed && !isClaimed) {
      events.push({
        kind: "work-released",
        workItemId: id,
        claimedBy: prev.claimedBy,
        pawnId: prev.claimedBy
      });
    }
    if (next.failureCount > prev.failureCount) {
      events.push({
        kind: "work-failed",
        workItemId: id,
        claimedBy: prev.claimedBy,
        pawnId: prev.claimedBy,
        failureCount: next.failureCount
      });
    }
    if (prev.status !== "completed" && next.status === "completed") {
      events.push({
        kind: "work-completed",
        workItemId: id,
        claimedBy: next.claimedBy,
        pawnId: next.claimedBy
      });
    }
  }

  return events;
}

export function currentClaimedWorkEvents(world: WorldSnapshot): readonly WorkLifecycleTraceEvent[] {
  return world.workItems
    .filter((work) => work.status === "claimed" || Boolean(work.claimedBy))
    .map((work) => ({
      kind: "work-claimed" as const,
      workItemId: work.id,
      claimedBy: work.claimedBy,
      pawnId: work.claimedBy
    }));
}

function formatPawnDecisionMessage(tick: number, decision: PawnDecisionTrace): string {
  return `[tick ${tick}] ${decision.pawnName} ${decision.decisionSource} -> ${decision.selectedCandidate?.goal ?? decision.result.kind}`;
}

function pawnDecisionSearchParts(decision: PawnDecisionTrace): string[] {
  return [
    decision.pawnName,
    decision.decisionSource,
    decision.selectedCandidate?.goal ?? "",
    decision.selectedCandidate?.reason ?? "",
    decision.result.kind,
    decision.result.blockedReason ?? "",
    decision.interruptReason ?? "",
    decision.before.debugLabel,
    decision.after.debugLabel,
    decision.after.activeWorkItemId ?? ""
  ].filter((value) => value.length > 0);
}

function formatWorkLifecycleMessage(tick: number, event: WorkLifecycleTraceEvent): string {
  return `[tick ${tick}] ${event.kind} ${event.workItemId}`;
}

export function mapSimDebugTickToRuntimeLogEvents(
  input: MapSimDebugTickToRuntimeLogEventsInput
): readonly RuntimeLogEvent[] {
  const events: RuntimeLogEvent[] = [];
  let nextSeq = input.seqStart;

  for (const decision of input.tick.pawnDecisions) {
    const message = formatPawnDecisionMessage(input.tick.tick, decision);
    events.push(
      createRuntimeLogEvent({
        runId: input.runId,
        seq: nextSeq,
        timestampIso: input.timestampIso,
        tick: input.tick.tick,
        category: "AI.Decision",
        verbosity: "Log",
        message,
        detail: {
          worldTime: input.tick.worldTime,
          pawnDecision: decision
        },
        searchTextParts: pawnDecisionSearchParts(decision)
      })
    );
    nextSeq += 1;
  }

  for (const event of input.tick.workLifecycleEvents) {
    const message = formatWorkLifecycleMessage(input.tick.tick, event);
    events.push(
      createRuntimeLogEvent({
        runId: input.runId,
        seq: nextSeq,
        timestampIso: input.timestampIso,
        tick: input.tick.tick,
        category: "Work.Lifecycle",
        verbosity: event.kind === "work-failed" ? "Warning" : "Log",
        message,
        detail: {
          worldTime: input.tick.worldTime,
          workLifecycleEvent: event
        },
        searchTextParts: [
          event.kind,
          event.workItemId,
          event.pawnId,
          event.claimedBy,
          event.derivedFromWorkId,
          event.reason
        ]
      })
    );
    nextSeq += 1;
  }

  return events;
}

export function formatSimDebugTrace(trace: SimDebugTrace): string {
  if (!trace.enabled) {
    return "debug trace disabled";
  }
  if (trace.ticks.length === 0) {
    return "debug trace enabled, no ticks captured";
  }

  const lines: string[] = [];
  for (const tick of trace.ticks) {
    lines.push(
      `tick ${tick.tick} day ${tick.worldTime.dayNumber} @ ${tick.worldTime.minuteOfDay} (${tick.worldTime.currentPeriod})`
    );
    for (const decision of tick.pawnDecisions) {
      const selected = decision.selectedCandidate?.goal ?? "none";
      const suffix = decision.interruptReason ? ` interrupt=${decision.interruptReason}` : "";
      lines.push(
        `  pawn ${decision.pawnName}: source=${decision.decisionSource} selected=${selected} result=${decision.result.kind}${suffix}`
      );
    }
    if (tick.workLifecycleEvents.length > 0) {
      const summary = tick.workLifecycleEvents.map((event) => `${event.kind}:${event.workItemId}`).join(", ");
      lines.push(`  work events: ${summary}`);
    }
    if (tick.workItems && tick.workItems.length > 0) {
      const summary = tick.workItems.map((work) => `${work.id}:${work.kind}:${work.status}`).join(", ");
      lines.push(`  work items: ${summary}`);
    }
  }
  return lines.join("\n");
}
