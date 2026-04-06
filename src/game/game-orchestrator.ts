/**
 * 每帧领域驱动：世界时钟、网格同步、时间边界事件总线、小人模拟 tick。
 * 与 Phaser 解耦；渲染/UI 通过 hooks 回调到场景。
 */

import { findClaimedWalkWorkIdForPawn, tickSimulation, type SimConfig } from "./behavior";
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
  subscribe,
  type TimeControlState,
  type TimeEvent,
  type TimeEventBus,
  type TimeOfDayPalette,
  type TimeOfDayState
} from "./time";
import { syncWorldGridForSimulation, type SimGridSyncState } from "./world-sim-bridge";
import { autoClaimOpenWorkItems, cleanupStaleTargetWorkItems, tickAnchoredWorkProgress } from "./world-work-tick";
import { buildWorkWalkTargets } from "./world-construct-tick";
import { REST_SLEEP_PRIORITY_THRESHOLD } from "./need/threshold-rules";
import { assignUnownedBeds } from "./bed-auto-assign";
import { clearPawnIntent, type PawnState } from "./pawn-state";
import { failWorkItem } from "./work/work-operations";
import { getWorldSnapshot } from "./world-core";
import type { OrchestratorWorldBridge } from "./orchestrator-world-bridge";
import type { PlayerWorldPort } from "../player/world-port-types";
import type { PawnDecisionTrace } from "../headless/sim-debug-trace";
import {
  commitPlayerSelectionToWorld,
  type PlayerSelectionCommitInput,
  type PlayerSelectionCommitOutcome
} from "../player/commit-player-intent";

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
  /** 树木与地面散落物资等与 WorldCore 实体同步的轻量图层。 */
  syncTreesAndGroundItems: () => void;
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
  private advancedSimulationLastTick = false;
  private lastAiEvents: readonly string[] = [];
  private lastPawnDecisionTraces: readonly PawnDecisionTrace[] = [];

  public constructor(private readonly options: GameOrchestratorOptions) {
    this.timeBus = options.timeEventBus ?? createTimeEventBus();
    subscribe(this.timeBus, (event: TimeEvent) => {
      if (event.kind !== "night-start") return;
      this.releaseWalkWorkForRestSeekingPawnsAtNightStart();
    });
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

  public tick(deltaMs: number): void {
    const { worldPort, worldGrid, interactionTemplate, sim, simConfig, rng, hooks } = this.options;
    const realDt = deltaMs / 1000;
    const timeControlState = sim.getTimeControlState();
    const simulationDt = effectiveSimulationDeltaSeconds(realDt, timeControlState);
    this.advancedSimulationLastTick = simulationDt > 0;
    this.lastAiEvents = [];
    this.lastPawnDecisionTraces = [];

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
    hooks.syncTreesAndGroundItems();

    if (simulationDt <= 0) {
      hooks.syncMarkerOverlay();
      hooks.syncHoverFromPointer();
      hooks.syncPawnDetailPanel();
      return;
    }

    let worldForWork = worldPort.getWorld();
    let pawnsForWork = sim.getPawns();
    const staleCleanup = cleanupStaleTargetWorkItems(worldForWork, pawnsForWork);
    if (staleCleanup.changed) {
      worldPort.setWorld(staleCleanup.world);
      sim.setPawns(staleCleanup.pawns);
      this.refreshSimulationGrid(interactionTemplate, false);
      worldForWork = worldPort.getWorld();
      pawnsForWork = sim.getPawns();
    }

    const { world: worldAfterClaim, pawns: pawnsAfterClaim } = autoClaimOpenWorkItems(
      worldForWork,
      pawnsForWork
    );
    if (worldAfterClaim !== worldForWork) {
      worldPort.setWorld(worldAfterClaim);
      this.refreshSimulationGrid(interactionTemplate, false);
    }
    if (pawnsAfterClaim !== pawnsForWork) {
      sim.setPawns([...pawnsAfterClaim]);
    }


    const worldForSim = worldPort.getWorld();
    const workWalkTargets = buildWorkWalkTargets(worldForSim);
    const result = tickSimulation({
      pawns: sim.getPawns(),
      reservations: sim.getReservations(),
      grid: worldGrid,
      simulationDt,
      config: simConfig,
      rng,
      workWalkTargets,
      worldWorkItems: worldForSim.workItems,
      timePeriod: worldForSim.time.currentPeriod,
      minuteOfDay: worldForSim.time.minuteOfDay
    });

    for (const msg of result.aiEvents) {
      console.info(msg);
    }
    this.lastAiEvents = result.aiEvents;

    sim.setReservations(result.reservations);
    sim.setPawns([...result.pawns]);

    if (result.workInterrupts && result.workInterrupts.length > 0) {
      let worldAfterInterrupt = worldPort.getWorld();
      for (const req of result.workInterrupts) {
        const { world: w, outcome } = failWorkItem(
          worldAfterInterrupt,
          req.workItemId,
          req.pawnId,
          req.reason
        );
        if (outcome.kind === "failed") {
          worldAfterInterrupt = w;
        }
      }
      if (worldAfterInterrupt !== worldPort.getWorld()) {
        worldPort.setWorld(worldAfterInterrupt);
        this.refreshSimulationGrid(interactionTemplate, false);
      }
    }

    const worldBeforeProgress = worldPort.getWorld();
    const { world: worldAfterProgress, pawns: pawnsAfterProgress } = tickAnchoredWorkProgress(
      worldBeforeProgress,
      sim.getPawns(),
      simulationDt
    );
    if (worldAfterProgress !== worldBeforeProgress) {
      worldPort.setWorld(worldAfterProgress);
      this.refreshSimulationGrid(interactionTemplate, false);
    }
    sim.setPawns(pawnsAfterProgress);

    const worldBeforeBeds = worldPort.getWorld();
    const worldAfterBeds = assignUnownedBeds(worldBeforeBeds, sim.getPawns());
    if (worldAfterBeds !== worldBeforeBeds) {
      worldPort.setWorld(worldAfterBeds);
      this.refreshSimulationGrid(interactionTemplate, false);
    }

    hooks.redrawInteractionPoints();
    hooks.syncPawnViews();
    hooks.syncMarkerOverlay();
    hooks.syncHoverFromPointer();
    hooks.syncPawnDetailPanel();
  }

  /** 夜晚开始：困意高的小人释放已认领的走向类工单，由下一帧行为优先选睡。 */
  private releaseWalkWorkForRestSeekingPawnsAtNightStart(): void {
    const { worldPort, interactionTemplate, sim } = this.options;
    let world = worldPort.getWorld();
    const pawnsBefore = sim.getPawns();
    let changedWorld = false;
    const nextPawns: PawnState[] = [];
    for (const pawn of pawnsBefore) {
      if (pawn.needs.rest <= REST_SLEEP_PRIORITY_THRESHOLD) {
        nextPawns.push(pawn);
        continue;
      }
      const workId = findClaimedWalkWorkIdForPawn(pawn.id, world.workItems);
      if (workId === undefined) {
        nextPawns.push(pawn);
        continue;
      }
      const { world: w, outcome } = failWorkItem(world, workId, pawn.id, "night-rest-interrupt");
      if (outcome.kind === "failed") {
        world = w;
        changedWorld = true;
      }
      nextPawns.push(
        clearPawnIntent({
          ...pawn,
          moveTarget: undefined,
          moveProgress01: 0,
          activeWorkItemId: undefined,
          workTimerSec: 0
        })
      );
    }
    if (changedWorld) {
      worldPort.setWorld(world);
      this.refreshSimulationGrid(interactionTemplate, false);
    }
    if (nextPawns.some((p, i) => p !== pawnsBefore[i])) {
      sim.setPawns(nextPawns);
    }
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

  /** 提供给 GameScene：本帧是否真正推进了模拟（暂停时为 false）。 */
  public didAdvanceSimulationLastTick(): boolean {
    return this.advancedSimulationLastTick;
  }

  /** 提供给 GameScene：上一帧模拟产生的 AI 文本事件。 */
  public getLastAiEvents(): readonly string[] {
    return this.lastAiEvents;
  }

  /**
   * 提供给 GameScene：上一帧的 pawn 决策追踪。
   * 当前 sim-loop 仅输出 AI 文本事件，未产出结构化决策轨迹，先返回空数组保持 API 兼容。
   */
  public getLastPawnDecisionTraces(): readonly PawnDecisionTrace[] {
    return this.lastPawnDecisionTraces;
  }
}

export function createGameOrchestrator(options: GameOrchestratorOptions): GameOrchestrator {
  return new GameOrchestrator(options);
}
