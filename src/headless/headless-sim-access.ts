/**
 * Headless 用 {@link GameOrchestratorSimAccess} 内存实现：闭包持有模拟侧可变状态，
 * 无 Phaser 依赖。
 */

import type { GameOrchestratorSimAccess } from "../game/game-orchestrator";
import type { PawnState } from "../game/pawn-state";
import {
  createReservationSnapshot,
  type ReservationSnapshot
} from "../game/map/world-grid";
import type { SimGridSyncState } from "../game/world-sim-bridge";
import {
  createInitialTimeOfDayState,
  DEFAULT_TIME_CONTROL_STATE,
  sampleTimeOfDayPalette,
  type TimeControlState,
  type TimeOfDayPalette,
  type TimeOfDayState
} from "../game/time";

export type HeadlessGameOrchestratorSimAccess = GameOrchestratorSimAccess & {
  /** 与 {@link GameOrchestratorSimAccess.getPawns} 共用同一数组引用，可原地观察或同步。 */
  getPawnsRef(): PawnState[];
  /**
   * 与 {@link GameOrchestratorSimAccess.getReservations} 共用同一 Map 引用；
   * 仿真与 orchestrator 通过 set/get 维护预订表。
   */
  getReservationsRef(): Map<string, string>;
};

export type CreateHeadlessSimAccessOptions = Readonly<{
  initialPawns?: readonly PawnState[];
  initialReservations?: ReservationSnapshot;
  initialTimeOfDayState?: TimeOfDayState;
  initialTimeOfDayPalette?: TimeOfDayPalette;
  initialTimeControl?: TimeControlState;
  initialSimGridSyncState?: SimGridSyncState | null;
}>;

function copyReservationsInto(target: Map<string, string>, source: ReservationSnapshot): void {
  target.clear();
  for (const [interactionPointId, pawnId] of source) {
    target.set(interactionPointId, pawnId);
  }
}

function replacePawns(target: PawnState[], next: readonly PawnState[]): void {
  target.length = 0;
  target.push(...next);
}

/**
 * 构造可供 {@link GameOrchestrator} 注入的内存 SimAccess；
 * pawns / reservations / timeOfDay / palette / timeControl / gridSync 均由闭包持有。
 */
export function createHeadlessSimAccess(
  options: CreateHeadlessSimAccessOptions = {}
): HeadlessGameOrchestratorSimAccess {
  let timeOfDayState: TimeOfDayState =
    options.initialTimeOfDayState ?? createInitialTimeOfDayState();
  let timeOfDayPalette: TimeOfDayPalette =
    options.initialTimeOfDayPalette ?? sampleTimeOfDayPalette(timeOfDayState);
  let timeControlState: TimeControlState = options.initialTimeControl
    ? { ...options.initialTimeControl }
    : { ...DEFAULT_TIME_CONTROL_STATE };
  let simGridSyncState: SimGridSyncState | null = options.initialSimGridSyncState ?? null;

  const pawns: PawnState[] = options.initialPawns ? [...options.initialPawns] : [];
  const reservations = new Map<string, string>();
  copyReservationsInto(reservations, options.initialReservations ?? createReservationSnapshot());

  const access: HeadlessGameOrchestratorSimAccess = {
    getPawns(): PawnState[] {
      return pawns;
    },
    setPawns(next: PawnState[]): void {
      replacePawns(pawns, next);
    },
    getReservations(): ReservationSnapshot {
      return reservations;
    },
    setReservations(next: ReservationSnapshot): void {
      copyReservationsInto(reservations, next);
    },
    getTimeOfDayState(): TimeOfDayState {
      return timeOfDayState;
    },
    setTimeOfDayState(next: TimeOfDayState): void {
      timeOfDayState = {
        dayNumber: next.dayNumber,
        minuteOfDay: next.minuteOfDay
      };
    },
    getTimeOfDayPalette(): TimeOfDayPalette {
      return timeOfDayPalette;
    },
    setTimeOfDayPalette(next: TimeOfDayPalette): void {
      timeOfDayPalette = next;
    },
    getTimeControlState(): TimeControlState {
      return timeControlState;
    },
    getSimGridSyncState(): SimGridSyncState | null {
      return simGridSyncState;
    },
    setSimGridSyncState(next: SimGridSyncState | null): void {
      simGridSyncState = next;
    },
    getPawnsRef(): PawnState[] {
      return pawns;
    },
    getReservationsRef(): Map<string, string> {
      return reservations;
    }
  };

  return access;
}
