/**
 * Headless 模拟 tick 差分事件：对比 PawnState 与世界快照，生成可测试的结构化事件流。
 */

import type { GridCoord } from "../game/map/world-grid";
import type { PawnActionState, PawnGoalState, PawnId, PawnState } from "../game/pawn-state";
import type { WorldSnapshot } from "../game/world-core-types";

export type SimEventKind =
  | "day-start"
  | "night-start"
  | "pawn-moved"
  | "pawn-motion-changed"
  | "pawn-goal-changed"
  | "pawn-action-changed"
  | "pawn-need-changed"
  | "work-created"
  | "work-claimed"
  | "work-completed"
  | "entity-spawned"
  | "entity-removed";

export type SimEvent =
  | Readonly<{
      tick: number;
      kind: "day-start";
      dayNumber: number;
      minuteOfDay: number;
    }>
  | Readonly<{
      tick: number;
      kind: "night-start";
      dayNumber: number;
      minuteOfDay: number;
    }>
  | Readonly<{
      tick: number;
      kind: "pawn-moved";
      pawnId: PawnId;
      before: GridCoord;
      after: GridCoord;
    }>
  | Readonly<{
      tick: number;
      kind: "pawn-motion-changed";
      pawnId: PawnId;
      before: Readonly<{ moveTarget: GridCoord | undefined; moveProgress01: number }>;
      after: Readonly<{ moveTarget: GridCoord | undefined; moveProgress01: number }>;
    }>
  | Readonly<{
      tick: number;
      kind: "pawn-goal-changed";
      pawnId: PawnId;
      before: PawnGoalState | undefined;
      after: PawnGoalState | undefined;
    }>
  | Readonly<{
      tick: number;
      kind: "pawn-action-changed";
      pawnId: PawnId;
      before: PawnActionState | undefined;
      after: PawnActionState | undefined;
    }>
  | Readonly<{
      tick: number;
      kind: "pawn-need-changed";
      pawnId: PawnId;
      before: Readonly<{ satiety: number; energy: number; needs: PawnState["needs"] }>;
      after: Readonly<{ satiety: number; energy: number; needs: PawnState["needs"] }>;
    }>
  | Readonly<{
      tick: number;
      kind: "work-created";
      workItemId: string;
    }>
  | Readonly<{
      tick: number;
      kind: "work-claimed";
      workItemId: string;
      claimedBy: string | undefined;
    }>
  | Readonly<{
      tick: number;
      kind: "work-completed";
      workItemId: string;
    }>
  | Readonly<{
      tick: number;
      kind: "entity-spawned";
      entityId: string;
    }>
  | Readonly<{
      tick: number;
      kind: "entity-removed";
      entityId: string;
    }>;

export type SimEventSummary = Readonly<{
  total: number;
  byKind: Readonly<Partial<Record<SimEventKind, number>>>;
}>;

export interface SimEventCollector {
  recordPawnDiff(
    before: readonly PawnState[],
    after: readonly PawnState[],
    tick: number
  ): void;
  recordWorldDiff(before: WorldSnapshot, after: WorldSnapshot, tick: number): void;
  getEvents(): readonly SimEvent[];
  getEventsByKind<K extends SimEventKind>(kind: K): ReadonlyArray<Extract<SimEvent, { kind: K }>>;
  getEventsByPawn(pawnId: PawnId): readonly SimEvent[];
  summary(): SimEventSummary;
  clear(): void;
}

function sameCell(a: GridCoord, b: GridCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

function sameGoal(a: PawnGoalState | undefined, b: PawnGoalState | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && a.reason === b.reason && a.targetId === b.targetId;
}

function sameAction(a: PawnActionState | undefined, b: PawnActionState | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && a.targetId === b.targetId;
}

function sameMoveTarget(a: GridCoord | undefined, b: GridCoord | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return sameCell(a, b);
}

function unionIds<T extends { id: string }>(
  before: readonly T[],
  after: readonly T[]
): string[] {
  const s = new Set<string>();
  for (const x of before) s.add(x.id);
  for (const x of after) s.add(x.id);
  return [...s].sort();
}

function eventTouchesPawn(event: SimEvent, pawnId: PawnId): boolean {
  switch (event.kind) {
    case "pawn-moved":
    case "pawn-motion-changed":
    case "pawn-goal-changed":
    case "pawn-action-changed":
    case "pawn-need-changed":
      return event.pawnId === pawnId;
    case "work-claimed":
      return event.claimedBy === pawnId;
    default:
      return false;
  }
}

export function createSimEventCollector(): SimEventCollector {
  const events: SimEvent[] = [];

  const recordPawnDiff = (
    before: readonly PawnState[],
    after: readonly PawnState[],
    tick: number
  ): void => {
    const beforeMap = new Map(before.map((p) => [p.id, p]));
    const afterMap = new Map(after.map((p) => [p.id, p]));
    for (const id of unionIds(before, after)) {
      const pb = beforeMap.get(id);
      const pa = afterMap.get(id);
      if (!pb || !pa) continue;
      if (!sameCell(pb.logicalCell, pa.logicalCell)) {
        events.push({
          tick,
          kind: "pawn-moved",
          pawnId: id,
          before: { ...pb.logicalCell },
          after: { ...pa.logicalCell }
        });
      }
      if (
        !sameMoveTarget(pb.moveTarget, pa.moveTarget) ||
        pb.moveProgress01 !== pa.moveProgress01
      ) {
        events.push({
          tick,
          kind: "pawn-motion-changed",
          pawnId: id,
          before: {
            moveTarget: pb.moveTarget ? { ...pb.moveTarget } : undefined,
            moveProgress01: pb.moveProgress01
          },
          after: {
            moveTarget: pa.moveTarget ? { ...pa.moveTarget } : undefined,
            moveProgress01: pa.moveProgress01
          }
        });
      }
      if (!sameGoal(pb.currentGoal, pa.currentGoal)) {
        events.push({
          tick,
          kind: "pawn-goal-changed",
          pawnId: id,
          before: pb.currentGoal,
          after: pa.currentGoal
        });
      }
      if (!sameAction(pb.currentAction, pa.currentAction)) {
        events.push({
          tick,
          kind: "pawn-action-changed",
          pawnId: id,
          before: pb.currentAction,
          after: pa.currentAction
        });
      }
      const needsBefore = pb.needs;
      const needsAfter = pa.needs;
      if (
        pb.satiety !== pa.satiety ||
        pb.energy !== pa.energy ||
        needsBefore.hunger !== needsAfter.hunger ||
        needsBefore.rest !== needsAfter.rest ||
        needsBefore.recreation !== needsAfter.recreation
      ) {
        events.push({
          tick,
          kind: "pawn-need-changed",
          pawnId: id,
          before: {
            satiety: pb.satiety,
            energy: pb.energy,
            needs: { ...needsBefore }
          },
          after: {
            satiety: pa.satiety,
            energy: pa.energy,
            needs: { ...needsAfter }
          }
        });
      }
    }
  };

  const recordWorldDiff = (before: WorldSnapshot, after: WorldSnapshot, tick: number): void => {
    const beforeEntities = new Map(before.entities.map((e) => [e.id, e]));
    const afterEntities = new Map(after.entities.map((e) => [e.id, e]));
    if (before.time.currentPeriod !== after.time.currentPeriod) {
      events.push({
        tick,
        kind: after.time.currentPeriod === "night" ? "night-start" : "day-start",
        dayNumber: after.time.dayNumber,
        minuteOfDay: after.time.minuteOfDay
      });
    }
    for (const id of unionIds(before.entities, after.entities)) {
      if (!beforeEntities.has(id) && afterEntities.has(id)) {
        events.push({ tick, kind: "entity-spawned", entityId: id });
      }
      if (beforeEntities.has(id) && !afterEntities.has(id)) {
        events.push({ tick, kind: "entity-removed", entityId: id });
      }
    }

    const beforeWork = new Map(before.workItems.map((w) => [w.id, w]));
    const afterWork = new Map(after.workItems.map((w) => [w.id, w]));
    for (const id of unionIds(before.workItems, after.workItems)) {
      const wb = beforeWork.get(id);
      const wa = afterWork.get(id);
      if (!wb && wa) {
        events.push({ tick, kind: "work-created", workItemId: id });
        if (wa.status === "claimed" || wa.claimedBy) {
          events.push({
            tick,
            kind: "work-claimed",
            workItemId: id,
            claimedBy: wa.claimedBy
          });
        }
        if (wa.status === "completed") {
          events.push({ tick, kind: "work-completed", workItemId: id });
        }
        continue;
      }
      if (!wb || !wa) continue;
      const wasClaimed = wb.status === "claimed" || Boolean(wb.claimedBy);
      const isClaimed = wa.status === "claimed" || Boolean(wa.claimedBy);
      if (!wasClaimed && isClaimed) {
        events.push({
          tick,
          kind: "work-claimed",
          workItemId: id,
          claimedBy: wa.claimedBy
        });
      }
      const wasCompleted = wb.status === "completed";
      const isCompleted = wa.status === "completed";
      if (!wasCompleted && isCompleted) {
        events.push({ tick, kind: "work-completed", workItemId: id });
      }
    }
  };

  return {
    recordPawnDiff,
    recordWorldDiff,
    getEvents: () => events,
    getEventsByKind: <K extends SimEventKind>(kind: K) =>
      events.filter((e): e is Extract<SimEvent, { kind: K }> => e.kind === kind),
    getEventsByPawn: (pawnId: PawnId) => events.filter((e) => eventTouchesPawn(e, pawnId)),
    summary: (): SimEventSummary => {
      const byKind: Partial<Record<SimEventKind, number>> = {};
      for (const e of events) {
        byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
      }
      return { total: events.length, byKind };
    },
    clear: () => {
      events.length = 0;
    }
  };
}
