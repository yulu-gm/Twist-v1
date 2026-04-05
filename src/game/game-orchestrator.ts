/**
 * 每帧领域驱动：世界时钟、网格同步、时间边界事件总线、小人模拟 tick。
 * 与 Phaser 解耦；渲染/UI 通过 hooks 回调到场景。
 */

import { tickSimulation, type SimConfig } from "./behavior";
import {
  pruneReservationSnapshot,
  type ReservationSnapshot,
  type WorldGridConfig
} from "./map";
import {
  advanceWorldClock,
  createTimeEventBus,
  detectTimeEvents,
  effectiveSimulationDeltaSeconds,
  publish,
  sampleTimeOfDayPalette,
  type TimeControlState,
  type TimeEventBus,
  type TimeOfDayPalette,
  type TimeOfDayState
} from "./time";
import { syncWorldGridForSimulation, type SimGridSyncState } from "./world-sim-bridge";
import { getWorldSnapshot } from "./world-core";
import type { OrchestratorWorldBridge } from "./orchestrator-world-bridge";
import type { PlayerWorldPort } from "../player/world-port-types";
import type { MockWorldSubmitResult } from "../player/s0-contract";
import type { PawnState } from "./pawn-state";
import {
  commitPlayerSelectionToWorld,
  rebuildTaskMarkersFromCommandResults,
  type PlayerSelectionCommitInput,
  type PlayerSelectionCommitOutcome
} from "../player/commit-player-intent";
import {
  scenarioToMockWorldPortConfig,
  type PlayerAcceptanceScenario
} from "../data/player-acceptance-scenarios";

export type GameOrchestratorSimAccess = Readonly<{
  getPawns: () => PawnState[];
  setPawns: (next: PawnState[]) => void;
  getReservations: () => ReservationSnapshot;
  setReservations: (next: ReservationSnapshot) => void;
  getTimeOfDayState: () => TimeOfDayState;
  setTimeOfDayState: (next: TimeOfDayState) => void;
  getTimeOfDayPalette: () => TimeOfDayPalette;
  setTimeOfDayPalette: (next: TimeOfDayPalette) => void;
  getTimeControlState: () => TimeControlState;
  getSimGridSyncState: () => SimGridSyncState | null;
  setSimGridSyncState: (next: SimGridSyncState | null) => void;
}>;

export type GameOrchestratorHooks = Readonly<{
  onPaletteChanged: () => void;
  syncTimeHud: () => void;
  redrawStoneCells: () => void;
  redrawInteractionPoints: () => void;
  syncPawnViews: () => void;
  syncMarkerOverlay: () => void;
  syncHoverFromPointer: () => void;
  syncPawnDetailPanel: () => void;
}>;

export type GameOrchestratorOptions = Readonly<{
  worldPort: OrchestratorWorldBridge;
  worldGrid: WorldGridConfig;
  interactionTemplate: WorldGridConfig;
  sim: GameOrchestratorSimAccess;
  simConfig: SimConfig;
  rng: () => number;
  hooks: GameOrchestratorHooks;
  /** 若省略则使用内部新建的总线（可通过 {@link GameOrchestrator.getTimeEventBus} 订阅） */
  timeEventBus?: TimeEventBus;
}>;

function sameTimeOfDayPalette(left: TimeOfDayPalette, right: TimeOfDayPalette): boolean {
  return (
    left.backgroundColor === right.backgroundColor &&
    left.gridLineColor === right.gridLineColor &&
    left.gridBorderColor === right.gridBorderColor &&
    left.primaryTextColor === right.primaryTextColor &&
    left.secondaryTextColor === right.secondaryTextColor
  );
}

export class GameOrchestrator {
  private readonly timeBus: TimeEventBus;

  public constructor(private readonly options: GameOrchestratorOptions) {
    this.timeBus = options.timeEventBus ?? createTimeEventBus();
  }

  public getTimeEventBus(): TimeEventBus {
    return this.timeBus;
  }

  public getPlayerWorldPort(): PlayerWorldPort {
    return this.options.worldPort;
  }

  public commitPlayerSelection(input: PlayerSelectionCommitInput): PlayerSelectionCommitOutcome {
    return commitPlayerSelectionToWorld(this.options.worldPort, input);
  }

  public mergeTaskMarkerOverlayWithWorld(overlay: ReadonlyMap<string, string>): Map<string, string> {
    return this.options.worldPort.mergeTaskMarkerOverlayWithWorld(overlay);
  }

  public applyAcceptanceScenarioGateway(scenario: PlayerAcceptanceScenario): void {
    this.options.worldPort.resetSession();
    this.options.worldPort.applyMockConfig(scenarioToMockWorldPortConfig(scenario));
  }

  /**
   * B 线验收回放：重放命令日志并返回新标记图与 HUD 文案（命令为空时返回 null 摘要，由调用方决定文案）。
   */
  public runAcceptanceReplay(nowMs: number): Readonly<{
    results: readonly MockWorldSubmitResult[];
    nextMarkers: Map<string, string>;
    summaryLine: string | null;
  }> {
    const port = this.options.worldPort;
    if (port.getCommandLog().length === 0) {
      return { results: [], nextMarkers: new Map(), summaryLine: null };
    }
    const results = port.replayAll(nowMs);
    const nextMarkers = port.mergeTaskMarkerOverlayWithWorld(
      rebuildTaskMarkersFromCommandResults(port.getCommandLog(), results)
    );
    const n = results.length;
    const ok = results.filter((r) => r.accepted).length;
    return { results, nextMarkers, summaryLine: `回放完成：${n} 条，接受 ${ok}/${n}` };
  }

  public tick(deltaMs: number): void {
    const { worldPort, worldGrid, interactionTemplate, sim, simConfig, rng, hooks } = this.options;
    const realDt = deltaMs / 1000;
    const timeControlState = sim.getTimeControlState();
    const simulationDt = effectiveSimulationDeltaSeconds(realDt, timeControlState);

    const worldBefore = worldPort.getWorld();
    const prevTimeSnapshot = worldBefore.time;

    const clock = advanceWorldClock(worldBefore, simulationDt, timeControlState);
    worldPort.setWorld(clock.world);

    this.refreshSimulationGrid(interactionTemplate, false);

    const nextTimeSnapshot = clock.world.time;
    const domainTimeEvents = detectTimeEvents(prevTimeSnapshot, nextTimeSnapshot);
    if (domainTimeEvents.length > 0) {
      publish(this.timeBus, domainTimeEvents);
    }

    const snapshotTime = getWorldSnapshot(clock.world).time;
    const nextTimeState: TimeOfDayState = {
      dayNumber: snapshotTime.dayNumber,
      minuteOfDay: snapshotTime.minuteOfDay
    };
    const nextPalette = sampleTimeOfDayPalette(nextTimeState);
    const paletteChanged = !sameTimeOfDayPalette(sim.getTimeOfDayPalette(), nextPalette);
    sim.setTimeOfDayState(nextTimeState);
    if (paletteChanged) {
      sim.setTimeOfDayPalette(nextPalette);
      hooks.onPaletteChanged();
    }
    hooks.syncTimeHud();

    if (simulationDt <= 0) {
      hooks.syncMarkerOverlay();
      hooks.syncHoverFromPointer();
      hooks.syncPawnDetailPanel();
      return;
    }

    const result = tickSimulation({
      pawns: sim.getPawns(),
      reservations: sim.getReservations(),
      grid: worldGrid,
      simulationDt,
      config: simConfig,
      rng
    });

    for (const msg of result.aiEvents) {
      console.info(msg);
    }

    sim.setReservations(result.reservations);
    sim.setPawns([...result.pawns]);

    hooks.redrawInteractionPoints();
    hooks.syncPawnViews();
    hooks.syncMarkerOverlay();
    hooks.syncHoverFromPointer();
    hooks.syncPawnDetailPanel();
  }

  private refreshSimulationGrid(interactionTemplate: WorldGridConfig, forceRedrawStones: boolean): void {
    const { worldPort, worldGrid, sim, hooks } = this.options;
    const world = worldPort.getWorld();
    const { blockedChanged, interactionChanged, next } = syncWorldGridForSimulation(
      worldGrid,
      world,
      interactionTemplate,
      sim.getSimGridSyncState()
    );
    sim.setSimGridSyncState(next);

    if (blockedChanged || forceRedrawStones) {
      hooks.redrawStoneCells();
    }

    if (interactionChanged) {
      const ids = new Set(worldGrid.interactionPoints.map((p) => p.id));
      sim.setReservations(pruneReservationSnapshot(sim.getReservations(), ids));
    }
  }

  /** 场景在 `create` 末尾首次同步网格时可调用（等价于原先 `refreshSimulationGridFromWorldCore(true)`）。 */
  public bootstrapSimulationGrid(): void {
    this.refreshSimulationGrid(this.options.interactionTemplate, true);
  }
}

export function createGameOrchestrator(options: GameOrchestratorOptions): GameOrchestrator {
  return new GameOrchestrator(options);
}
