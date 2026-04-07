/**
 * 每帧领域驱动：世界时钟、网格同步、时间边界事件总线、小人模拟 tick。
 * 与 Phaser 解耦；渲染/UI 通过 hooks 回调到场景。
 */

import {
  createBehaviorFSM,
  findClaimedWalkWorkIdForPawn,
  tickSimulation,
  type BehaviorFSM,
  type SimConfig
} from "./behavior";
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
  timeSliceAdvancedEvent,
  subscribe,
  type TimeControlState,
  type TimeEvent,
  type TimeEventBus,
  type TimeOfDayState
} from "./time";
import { sampleTimeOfDayPalette, type TimeOfDayPalette } from "../ui/time-of-day-palette";
import { syncWorldGridForSimulation, type SimGridSyncState } from "./world-sim-bridge";
import { autoClaimOpenWorkItems, cleanupStaleTargetWorkItems, tickAnchoredWorkProgress } from "./world-work-tick";
import { buildWorkWalkTargets } from "./work-walk-targets";
import { REST_SLEEP_PRIORITY_THRESHOLD } from "./need/threshold-rules";
import { assignUnownedBeds, ENABLE_PER_FRAME_UNOWNED_BED_FALLBACK } from "./bed-auto-assign";
import { setupNightRestFlow } from "./flows/night-rest-flow";
import { clearPawnIntent, type PawnId, type PawnState } from "./pawn-state";
import { failWorkItem } from "./work/work-operations";
import { getWorldSnapshot } from "./world-core";
import type { OrchestratorWorldBridge, WorldSimAccess } from "../player/orchestrator-world-bridge";
import type { PlayerWorldPort } from "../player/world-port-types";
import type { PawnDecisionTrace } from "./behavior/pawn-decision-trace";
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
  setTimeControlState: (next: TimeControlState) => void;
  getSimGridSyncState: () => SimGridSyncState | null;
  setSimGridSyncState: (next: SimGridSyncState | null) => void;
}>;

/**
 * 经 SimAccess 与编排器同源路径追加小人；夹具应调用本函数，而非对 `getPawnsRef().push`（行动点 #0217）。
 */
export function registerPawnWithSimAccess(sim: GameOrchestratorSimAccess, pawn: PawnState): void {
  sim.setPawns([...sim.getPawns(), pawn]);
}

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
  /** 为 true 时以 `console.debug` 输出本帧 `tickSimulation` 的 AI 文本事件；默认关闭。 */
  debugLogAiEvents?: boolean;
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
  private readonly nightRestFsmByPawn = new Map<PawnId, BehaviorFSM>();
  private advancedSimulationLastTick = false;
  private lastAiEvents: readonly string[] = [];
  private lastPawnDecisionTraces: readonly PawnDecisionTrace[] = [];

  public constructor(private readonly options: GameOrchestratorOptions) {
    this.timeBus = options.timeEventBus ?? createTimeEventBus();
    // night-start：先释放困意高者的走向工单，再由夜间归宿流将有床小人的 FSM 切入 resting（订阅顺序即调用顺序）。
    subscribe(this.timeBus, (event: TimeEvent) => {
      if (event.kind !== "night-start") return;
      this.releaseWalkWorkForRestSeekingPawnsAtNightStart();
    });
    setupNightRestFlow(this.timeBus, {
      getWorld: () => this.options.worldPort.getWorld(),
      getFsm: (pawnId) => this.ensureNightRestFsm(pawnId)
    });
  }

  private ensureNightRestFsm(pawnId: PawnId): BehaviorFSM {
    let fsm = this.nightRestFsmByPawn.get(pawnId);
    if (!fsm) {
      fsm = createBehaviorFSM(pawnId);
      this.nightRestFsmByPawn.set(pawnId, fsm);
    }
    return fsm;
  }

  public getTimeEventBus(): TimeEventBus {
    return this.timeBus;
  }

  public getPlayerWorldPort(): PlayerWorldPort {
    return this.options.worldPort;
  }

  /** 仅世界内核访问；UI/场景需要 `WorldCore` 时应调用此方法，而非将 {@link getPlayerWorldPort} 断言为整桥。 */
  public getWorldSimAccess(): WorldSimAccess {
    return this.options.worldPort;
  }

  public commitPlayerSelection(input: PlayerSelectionCommitInput): PlayerSelectionCommitOutcome {
    const outcome = commitPlayerSelectionToWorld(this.options.worldPort, input);
    if (outcome.didSubmitToWorld) {
      this.options.hooks.syncTreesAndGroundItems();
      this.options.hooks.syncMarkerOverlay();
      this.options.hooks.syncHoverFromPointer();
      this.options.hooks.syncPawnDetailPanel();
    }
    return outcome;
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
    const domainTimeEvents = detectTimeEvents(
      prevTimeSnapshot,
      nextTimeSnapshot,
      clock.world.timeConfig
    );
    const timeBusBatch: TimeEvent[] =
      clock.elapsedSimulationSeconds > 0
        ? [...domainTimeEvents, timeSliceAdvancedEvent(nextTimeSnapshot)]
        : [...domainTimeEvents];
    if (timeBusBatch.length > 0) {
      publish(this.timeBus, timeBusBatch);
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
      // 暂停时无 tickAnchoredWorkProgress；仍需与 WorldCore 对齐树木/地面/建筑图层。
      hooks.syncTreesAndGroundItems();
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
    const workWalkTargets = buildWorkWalkTargets(worldForSim, sim.getPawns());
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
      minuteOfDay: worldForSim.time.minuteOfDay,
      restSpots: worldForSim.restSpots
    });

    if (this.options.debugLogAiEvents) {
      for (const msg of result.aiEvents) {
        console.debug(msg);
      }
    }
    this.lastAiEvents = result.aiEvents;
    this.lastPawnDecisionTraces = result.pawnDecisionTraces;

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
      simulationDt,
      this.options.simConfig
    );
    if (worldAfterProgress !== worldBeforeProgress) {
      worldPort.setWorld(worldAfterProgress);
      this.refreshSimulationGrid(interactionTemplate, false);
    }
    sim.setPawns(pawnsAfterProgress);

    if (ENABLE_PER_FRAME_UNOWNED_BED_FALLBACK) {
      const worldBeforeBeds = worldPort.getWorld();
      const worldAfterBeds = assignUnownedBeds(worldBeforeBeds, sim.getPawns());
      if (worldAfterBeds !== worldBeforeBeds) {
        worldPort.setWorld(worldAfterBeds);
        this.refreshSimulationGrid(interactionTemplate, false);
      }
    }

    // 须在 tickSimulation / tickAnchoredWorkProgress 等写入世界之后再同步，否则蓝图落成后仍一帧（或多帧）显示施工虚影。
    hooks.syncTreesAndGroundItems();
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
   * 提供给 GameScene：上一帧行为 sim-loop（tickSimulation）产出的 pawn 决策追踪（暂停帧为空）。
   */
  public getLastPawnDecisionTraces(): readonly PawnDecisionTrace[] {
    return this.lastPawnDecisionTraces;
  }
}

export function createGameOrchestrator(options: GameOrchestratorOptions): GameOrchestrator {
  return new GameOrchestrator(options);
}
