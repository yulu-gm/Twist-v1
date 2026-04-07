/**
 * Headless 用 {@link GameOrchestratorSimAccess} 内存实现：闭包持有模拟侧可变状态，
 * 无 Phaser 依赖。
 */

import type { GameOrchestratorSimAccess } from "../game/game-orchestrator";
import type { PawnState } from "../game/pawn-state";
import {
  createReservationSnapshot,
  type ReservationSnapshot
} from "../game/map";
import type { SimGridSyncState } from "../game/world-sim-bridge";
import {
  createInitialTimeOfDayState,
  DEFAULT_TIME_CONTROL_STATE,
  type TimeControlState,
  type TimeOfDayState
} from "../game/time";
import { sampleTimeOfDayPalette, type TimeOfDayPalette } from "../ui/time-of-day-palette";

/**
 * 无头 SimAccess：在 {@link GameOrchestratorSimAccess} 合约之上可选暴露 ref，用于零拷贝同步仿真侧状态。
 *
 * **单方写入约定**：若调用方通过 `getPawnsRef` / `getReservationsRef` 原地修改集合，须与注入本 access 的
 * {@link GameOrchestrator}（或唯一认可的 headless 驱动）事先约定**同一时刻仅一方**承担写入；
 * 其他模块仍应走 `setPawns` / `setReservations`，禁止多写入源并行改同一闭包内集合，以免违背
 * `oh-code-design/实体系统.yaml` 中应用编排层统一协调实体视图的意图。
 */
export type HeadlessGameOrchestratorSimAccess = GameOrchestratorSimAccess & {
  /**
   * @internal 仅供自动化测试等需与闭包内数组**同一引用**的观测/同步场景。
   * 生产与场景运行路径应使用 {@link GameOrchestratorSimAccess.getPawns} / {@link GameOrchestratorSimAccess.setPawns}，避免旁路原地写入。
   * 若必须原地写入：须遵守类型文档所述与编排层的单方写入约定。
   */
  getPawnsRef(): PawnState[];
  /**
   * @internal 仅供自动化测试等需与闭包内 Map **同一引用**的观测/同步场景。
   * 生产与场景运行路径应使用 {@link GameOrchestratorSimAccess.getReservations} / {@link GameOrchestratorSimAccess.setReservations}，避免旁路原地写入。
   * 若必须原地写入：须遵守类型文档所述与编排层的单方写入约定。
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
      return { ...timeControlState };
    },
    setTimeControlState(next: TimeControlState): void {
      timeControlState = { ...next };
    },
    getSimGridSyncState(): SimGridSyncState | null {
      return simGridSyncState;
    },
    setSimGridSyncState(next: SimGridSyncState | null): void {
      simGridSyncState = next;
    },
    /** @internal 见 {@link HeadlessGameOrchestratorSimAccess.getPawnsRef}。 */
    getPawnsRef(): PawnState[] {
      return pawns;
    },
    /** @internal 见 {@link HeadlessGameOrchestratorSimAccess.getReservationsRef}。 */
    getReservationsRef(): Map<string, string> {
      return reservations;
    }
  };

  return access;
}
