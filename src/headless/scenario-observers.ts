import { commandMenuDomainSemantics, type CommandMenuCommandId } from "../data/command-menu";
import { formatTimeOfDayLabel } from "../game/time";
import type { SelectionModifier } from "../game/interaction/floor-selection";
import type { GridCoord } from "../game/map";
import {
  WORK_ITEM_ANCHOR_DURATION_SEC,
  workItemAnchorDurationSeconds
} from "../game/work";
import type { WorkItemSnapshot } from "../game/work/work-types";
import type { PlayerSelectionCommitOutcome } from "../player/commit-player-intent";
import type { HeadlessSim } from "./headless-sim";
import type {
  ScenarioPlayerInputSemantic,
  ScenarioPlayerInputShape,
  ScenarioPlayerSelectionAfterHydrate
} from "./scenario-types";
import type { AssertionResult } from "./sim-reporter";

export type ScenarioPlayerSelectionRecord = Readonly<{
  label: string;
  commandId: CommandMenuCommandId;
  /** 与 {@link commandMenuDomainSemantics} 一致，供任务标记/断言。 */
  markerToolId: string;
  selectionModifier: SelectionModifier;
  semantic: ScenarioPlayerInputSemantic;
  inputShape: ScenarioPlayerInputShape;
  cellKeys: readonly string[];
  didSubmitToWorld: boolean;
  accepted: boolean | null;
  commandVerb: string | null;
  resultSummaryLine: string | null;
  messages: readonly string[];
  conflictCellKeys: readonly string[];
}>;

export type ScenarioHydrationResult = Readonly<{
  playerSelections: readonly ScenarioPlayerSelectionRecord[];
}>;

export type VisibleHudSnapshot = Readonly<{
  layer: "hud";
  dayNumber: number;
  minuteOfDay: number;
  timeLabel: string;
  period: "day" | "night";
  paused: boolean;
  speed: 1 | 2 | 3;
}>;

export type VisibleWorkItemSnapshot = Readonly<{
  layer: "world";
  id: string;
  kind: WorkItemSnapshot["kind"];
  status: WorkItemSnapshot["status"];
  claimedBy: string | undefined;
  failureCount: number;
  anchorCell: GridCoord;
  /**
   * 与 {@link PawnState.workTimerSec} 对齐：某小人 `activeWorkItemId === id` 时，其累计锚格读条秒数。
   * 多小人同指一单时取最大累计值（防御性）。
   */
  anchorWorkTimerSec: number | undefined;
  /**
   * 0..1，由 `anchorWorkTimerSec` 与该工单类型默认 {@link WORK_ITEM_ANCHOR_DURATION_SEC} 推导。
   * 无读条或未匹配到认领者时为 `undefined`。
   */
  anchorProgress01: number | undefined;
}>;

export type VisibleOwnershipSnapshot = Readonly<{
  layer: "world";
  entityId: string;
  entityKind: string;
  buildingKind: string | undefined;
  ownerPawnId: string | undefined;
  assignmentReason: string | undefined;
  cell: GridCoord;
}>;

export type VisibleFeedbackSnapshot = Readonly<{
  layer: "player-channel" | "world";
  source: "submit-result" | "work-item-failure";
  accepted: boolean | null;
  text: string;
}>;

export type VisibleStateSnapshot = Readonly<{
  hud: VisibleHudSnapshot;
  workItems: readonly VisibleWorkItemSnapshot[];
  ownerships: readonly VisibleOwnershipSnapshot[];
  failures: readonly VisibleFeedbackSnapshot[];
}>;

type VisibleStateOptions = Readonly<{
  playerSelections?: readonly ScenarioPlayerSelectionRecord[];
}>;

type VisibleHudExpectation = Readonly<{
  timeLabel?: string;
  minuteOfDay?: number;
  dayNumber?: number;
  period?: "day" | "night";
  paused?: boolean;
  speed?: 1 | 2 | 3;
}>;

type VisibleWorkItemExpectation = Readonly<{
  id?: string;
  kind?: WorkItemSnapshot["kind"];
  status?: WorkItemSnapshot["status"];
  claimedBy?: string;
  failureCountAtLeast?: number;
  anchorWorkTimerSec?: number;
  anchorWorkTimerSecAtLeast?: number;
  anchorProgress01AtLeast?: number;
  anchorProgress01AtMost?: number;
}>;

type VisibleOwnershipExpectation = Readonly<{
  entityId?: string;
  buildingKind?: string;
  ownerPawnId?: string;
}>;

type VisibleFailureExpectation = Readonly<{
  textIncludes?: string;
  source?: VisibleFeedbackSnapshot["source"];
  accepted?: boolean | null;
}>;

function defaultLabel(prefix: string, detail: string): string {
  return `${prefix}: ${detail}`;
}

/** 各工单当前锚格读条累计（秒）；键为 `activeWorkItemId`。 */
function maxAnchorWorkTimerSecByWorkItemId(
  pawns: readonly { activeWorkItemId?: string; workTimerSec: number }[]
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const p of pawns) {
    const wid = p.activeWorkItemId;
    if (wid === undefined) continue;
    const prev = map.get(wid);
    if (prev === undefined || p.workTimerSec > prev) {
      map.set(wid, p.workTimerSec);
    }
  }
  return map;
}

export function resolveScenarioPlayerInputSemantic(
  selection: ScenarioPlayerSelectionAfterHydrate
): ScenarioPlayerInputSemantic {
  return selection.semantics ?? selection.inputShape;
}

export function recordScenarioPlayerSelection(
  selection: ScenarioPlayerSelectionAfterHydrate,
  outcome?: PlayerSelectionCommitOutcome
): ScenarioPlayerSelectionRecord {
  const semantic = resolveScenarioPlayerInputSemantic(selection);
  const commandId = selection.commandId;
  const markerToolId = commandMenuDomainSemantics(commandId).markerToolId;
  return {
    label: selection.label ?? `${selection.commandId}:${semantic}`,
    commandId,
    markerToolId,
    selectionModifier: selection.selectionModifier,
    semantic,
    inputShape: selection.inputShape,
    cellKeys: [...selection.cellKeys],
    didSubmitToWorld: outcome?.didSubmitToWorld ?? false,
    accepted: outcome?.submitResult?.accepted ?? null,
    commandVerb: outcome?.command?.verb ?? null,
    resultSummaryLine: outcome?.resultSummaryLine ?? null,
    messages: outcome?.submitResult?.messages ?? [],
    conflictCellKeys: outcome?.submitResult?.conflictCellKeys ?? []
  };
}

export function captureVisibleState(
  sim: HeadlessSim,
  options: VisibleStateOptions = {}
): VisibleStateSnapshot {
  const world = sim.getWorldPort().getWorld();
  const anchorTimers = maxAnchorWorkTimerSecByWorkItemId(sim.getPawns());
  const hud: VisibleHudSnapshot = {
    layer: "hud",
    dayNumber: world.time.dayNumber,
    minuteOfDay: world.time.minuteOfDay,
    timeLabel: formatTimeOfDayLabel(world.time),
    period: world.time.currentPeriod,
    paused: world.time.paused,
    speed: world.time.speed
  };

  const workItems = [...world.workItems.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((item) => {
      const anchorWorkTimerSec = anchorTimers.get(item.id);
      const durationSec = workItemAnchorDurationSeconds(WORK_ITEM_ANCHOR_DURATION_SEC, item.kind);
      const anchorProgress01 =
        anchorWorkTimerSec !== undefined && durationSec > 0
          ? Math.max(0, Math.min(1, anchorWorkTimerSec / durationSec))
          : undefined;
      return {
        layer: "world" as const,
        id: item.id,
        kind: item.kind,
        status: item.status,
        claimedBy: item.claimedBy,
        failureCount: item.failureCount,
        anchorCell: { ...item.anchorCell },
        anchorWorkTimerSec,
        anchorProgress01
      };
    });

  const ownerships = [...world.entities.values()]
    .filter((entity) => entity.ownership !== undefined)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entity) => ({
      layer: "world" as const,
      entityId: entity.id,
      entityKind: entity.kind,
      buildingKind: entity.buildingKind,
      ownerPawnId: entity.ownership?.ownerPawnId,
      assignmentReason: entity.ownership?.assignmentReason,
      cell: { ...entity.cell }
    }));

  const failures: VisibleFeedbackSnapshot[] = [];
  for (const selection of options.playerSelections ?? []) {
    const line = selection.resultSummaryLine ?? selection.messages[0];
    if (!line) continue;
    failures.push({
      layer: "player-channel",
      source: "submit-result",
      accepted: selection.accepted,
      text: line
    });
  }
  for (const item of workItems) {
    if (item.failureCount <= 0) continue;
    failures.push({
      layer: "world",
      source: "work-item-failure",
      accepted: null,
      text: `work ${item.id} failure-count ${item.failureCount}`
    });
  }

  return { hud, workItems, ownerships, failures };
}

export function assertPlayerInputSemantic(
  selection: ScenarioPlayerSelectionRecord,
  semantic: ScenarioPlayerInputSemantic,
  label: string = defaultLabel("assertPlayerInputSemantic", semantic)
): AssertionResult {
  if (selection.semantic === semantic) {
    return { passed: true, label, message: "ok" };
  }
  return {
    passed: false,
    label,
    message: `selection ${selection.label} semantic=${selection.semantic}, expected ${semantic}`
  };
}

export function assertVisibleHudTime(
  sim: HeadlessSim,
  expected: VisibleHudExpectation,
  label: string = "assertVisibleHudTime"
): AssertionResult {
  const hud = captureVisibleState(sim).hud;
  if (expected.timeLabel !== undefined && hud.timeLabel !== expected.timeLabel) {
    return {
      passed: false,
      label,
      message: `timeLabel=${hud.timeLabel}, expected ${expected.timeLabel}`
    };
  }
  if (expected.minuteOfDay !== undefined && hud.minuteOfDay !== expected.minuteOfDay) {
    return {
      passed: false,
      label,
      message: `minuteOfDay=${hud.minuteOfDay}, expected ${expected.minuteOfDay}`
    };
  }
  if (expected.dayNumber !== undefined && hud.dayNumber !== expected.dayNumber) {
    return {
      passed: false,
      label,
      message: `dayNumber=${hud.dayNumber}, expected ${expected.dayNumber}`
    };
  }
  if (expected.period !== undefined && hud.period !== expected.period) {
    return {
      passed: false,
      label,
      message: `period=${hud.period}, expected ${expected.period}`
    };
  }
  if (expected.paused !== undefined && hud.paused !== expected.paused) {
    return {
      passed: false,
      label,
      message: `paused=${hud.paused}, expected ${expected.paused}`
    };
  }
  if (expected.speed !== undefined && hud.speed !== expected.speed) {
    return {
      passed: false,
      label,
      message: `speed=${hud.speed}, expected ${expected.speed}`
    };
  }
  return { passed: true, label, message: "ok" };
}

export function assertVisibleWorkItemState(
  sim: HeadlessSim,
  expected: VisibleWorkItemExpectation,
  label: string = "assertVisibleWorkItemState"
): AssertionResult {
  const match = captureVisibleState(sim).workItems.find((item) => {
    if (expected.id !== undefined && item.id !== expected.id) return false;
    if (expected.kind !== undefined && item.kind !== expected.kind) return false;
    if (expected.status !== undefined && item.status !== expected.status) return false;
    if (expected.claimedBy !== undefined && item.claimedBy !== expected.claimedBy) return false;
    if (
      expected.failureCountAtLeast !== undefined &&
      item.failureCount < expected.failureCountAtLeast
    ) {
      return false;
    }
    if (
      expected.anchorWorkTimerSec !== undefined &&
      item.anchorWorkTimerSec !== expected.anchorWorkTimerSec
    ) {
      return false;
    }
    if (
      expected.anchorWorkTimerSecAtLeast !== undefined &&
      (item.anchorWorkTimerSec === undefined ||
        item.anchorWorkTimerSec < expected.anchorWorkTimerSecAtLeast)
    ) {
      return false;
    }
    if (
      expected.anchorProgress01AtLeast !== undefined &&
      (item.anchorProgress01 === undefined ||
        item.anchorProgress01 < expected.anchorProgress01AtLeast)
    ) {
      return false;
    }
    if (
      expected.anchorProgress01AtMost !== undefined &&
      (item.anchorProgress01 === undefined ||
        item.anchorProgress01 > expected.anchorProgress01AtMost)
    ) {
      return false;
    }
    return true;
  });
  if (match) {
    return { passed: true, label, message: "ok" };
  }
  return {
    passed: false,
    label,
    message: `no visible work item matched ${JSON.stringify(expected)}`
  };
}

export function assertVisibleOwnership(
  sim: HeadlessSim,
  expected: VisibleOwnershipExpectation,
  label: string = "assertVisibleOwnership"
): AssertionResult {
  const match = captureVisibleState(sim).ownerships.find((item) => {
    if (expected.entityId !== undefined && item.entityId !== expected.entityId) return false;
    if (expected.buildingKind !== undefined && item.buildingKind !== expected.buildingKind) {
      return false;
    }
    if (expected.ownerPawnId !== undefined && item.ownerPawnId !== expected.ownerPawnId) {
      return false;
    }
    return true;
  });
  if (match) {
    return { passed: true, label, message: "ok" };
  }
  return {
    passed: false,
    label,
    message: `no visible ownership matched ${JSON.stringify(expected)}`
  };
}

export function assertVisibleFailureFeedback(
  sim: HeadlessSim,
  expected: VisibleFailureExpectation,
  options: VisibleStateOptions = {},
  label: string = "assertVisibleFailureFeedback"
): AssertionResult {
  const match = captureVisibleState(sim, options).failures.find((item) => {
    if (expected.source !== undefined && item.source !== expected.source) return false;
    if (expected.accepted !== undefined && item.accepted !== expected.accepted) return false;
    if (expected.textIncludes !== undefined && !item.text.includes(expected.textIncludes)) {
      return false;
    }
    return true;
  });
  if (match) {
    return { passed: true, label, message: "ok" };
  }
  return {
    passed: false,
    label,
    message: `no visible failure feedback matched ${JSON.stringify(expected)}`
  };
}
