import Phaser from "phaser";
import {
  createDefaultPawnStates,
  DEFAULT_PAWN_NAMES,
  pickRandomAltPawnNames,
  type PawnState
} from "../game/pawn-state";
import {
  createInitialTimeOfDayState,
  DEFAULT_TIME_CONTROL_STATE,
  DEFAULT_TIME_OF_DAY_CONFIG,
  type TimeControlState,
  type TimeOfDayState,
  type TimeSpeed
} from "../game/time";
import { sampleTimeOfDayPalette, type TimeOfDayPalette } from "../ui/time-of-day-palette";
import { GameOrchestrator } from "../game/game-orchestrator";
import { bootstrapWorldForScene } from "../game/world-bootstrap";
import { createWorldCore } from "../game/world-core";
import {
  createReservationSnapshot,
  DEFAULT_INTERACTION_TEMPLATE_GRID,
  DEFAULT_SCENARIO_INTERACTION_POINTS,
  DEFAULT_WORLD_GRID,
  type InteractionPoint,
  type ReservationSnapshot,
  type WorldGridConfig
} from "../game/map";
import { seedBlockedCellsAsObstacles } from "../game/world-seed-obstacles";
import type { SimGridSyncState } from "../game/world-sim-bridge";
import { type SimConfig } from "../game/behavior";
import { createInteractiveClientSimConfig } from "./main-scene-sim-config";
import { HudManager } from "../ui/hud-manager";
import { defaultCommandMenuCommandId, type CommandMenuCommandId } from "../data/command-menu";
import { createCommandMenuState, selectCommandMenuCommand as selectCommandMenuStateCommand } from "../ui/menu-model";
import {
  drawGridLines,
  drawStoneCellsToGraphics,
  drawInteractionPoints
} from "./renderers/grid-renderer";
import {
  createPawnViews,
  destroyPawnViews,
  syncPawnViews,
  type PawnView
} from "./renderers/pawn-renderer";
import { syncGroundResourceItems } from "./renderers/ground-items-renderer";
import { drawTreesToGraphics } from "./renderers/tree-renderer";
import { drawZoneOverlaysToGraphics } from "./renderers/zone-overlay-renderer";
import { drawBuildingsAndBlueprintsToGraphics } from "./renderers/building-renderer";
import { syncTaskMarkerView } from "./renderers/selection-renderer";
import { MAP_OVERLAY_DEPTH } from "./map-overlay-depths";
import { GameSceneCameraControls } from "./game-scene-camera-controls";
import { GameSceneFloorInteraction } from "./game-scene-floor-interaction";
import {
  applyTimeOfDayPaletteToScene,
  mergeMarkerOverlayIfChanged,
  redrawTaskMarkers,
  syncHoverFromPointerState,
  type TimeOfDayPalettePresentationDeps
} from "./game-scene-presentation";
import { syncPlayerChannelHintLines } from "./game-scene-hud-sync";
import { GameSceneKeyboardBindings } from "./game-scene-keyboard-bindings";
import { loadScenarioIntoGame } from "../player/scenario-loader";
import { ALL_SCENARIOS } from "../../scenarios";
import { WorldCoreWorldPort } from "../player/world-core-world-port";
import type { ScenarioDefinition } from "../headless/scenario-types";
import { getWorldSnapshot, projectTreeSnapshotsForRender } from "../game/world-core";
import { diffWorkLifecycleEvents, type WorkLifecycleTraceEvent } from "../headless/sim-debug-trace";
import type { PawnDecisionTrace } from "../game/behavior/pawn-decision-trace";
import { getRuntimeLogSession } from "../runtime-log/runtime-log-session";
import { selectRuntimeDebugLogEntries } from "../ui/runtime-debug-log-store";

export type GameSceneVariant = "default" | "alt-en";

export class GameScene extends Phaser.Scene {
  private gridOriginX = 0;
  private gridOriginY = 0;
  private worldGrid: WorldGridConfig = DEFAULT_WORLD_GRID;

  private pawns: PawnState[] = [];
  private reservations: ReservationSnapshot = createReservationSnapshot();
  private timeOfDayState: TimeOfDayState = createInitialTimeOfDayState(DEFAULT_TIME_OF_DAY_CONFIG);
  private timeOfDayPalette: TimeOfDayPalette = sampleTimeOfDayPalette(
    createInitialTimeOfDayState(DEFAULT_TIME_OF_DAY_CONFIG)
  );
  private timeControlState: TimeControlState = DEFAULT_TIME_CONTROL_STATE;

  private views = new Map<string, PawnView>();
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private stoneGraphics!: Phaser.GameObjects.Graphics;
  private interactionGraphics!: Phaser.GameObjects.Graphics;
  private interactionLabels = new Map<string, Phaser.GameObjects.Text>();
  private hoverHighlightFrame!: Phaser.GameObjects.Rectangle;
  private lastHoverKeyRef = { current: "\0" as string | null };
  private floorSelectionGraphics!: Phaser.GameObjects.Graphics;
  private floorSelectionDraftGraphics!: Phaser.GameObjects.Graphics;
  private taskMarkerGraphics!: Phaser.GameObjects.Graphics;
  private taskMarkerTexts = new Map<string, Phaser.GameObjects.Text>();
  private treeGraphics!: Phaser.GameObjects.Graphics;
  private buildingGraphics!: Phaser.GameObjects.Graphics;
  private groundResourceGraphics!: Phaser.GameObjects.Graphics;
  private zoneOverlayGraphics!: Phaser.GameObjects.Graphics;
  private groundResourceLabels = new Map<string, Phaser.GameObjects.Text>();
  private groundResourceCountLabels = new Map<string, Phaser.GameObjects.Text>();
  private storageZoneLabels = new Map<string, Phaser.GameObjects.Text>();

  private variant: GameSceneVariant = "default";
  private commandMenuState = createCommandMenuState({
    isOpen: true,
    activeCommandId: defaultCommandMenuCommandId()
  });
  private selectedPawnId: string | null = null;
  private taskMarkersByCell = new Map<string, string>();

  private readonly keyboard = new GameSceneKeyboardBindings();

  private simConfig: SimConfig = createInteractiveClientSimConfig();
  private simGridSyncState: SimGridSyncState | null = null;
  private orchestrator!: GameOrchestrator;
  private floorInteraction!: GameSceneFloorInteraction;
  private cameraControls!: GameSceneCameraControls;

  private hud!: HudManager;
  private readonly runtimeLogSession = getRuntimeLogSession();
  private readonly runtimeDebugLogStore = this.runtimeLogSession.store;
  private debugPanelOpen = false;
  private debugLogPaused = false;
  private debugFilter = "";
  private debugSelectedEntryId: string | null = null;
  private debugPausedSeq: number | null = null;
  private runtimeTickCount = 0;

  public constructor() {
    super("game");
  }

  public init(data: { variant?: string } = {}): void {
    this.variant = data.variant === "alt-en" ? "alt-en" : "default";
    this.commandMenuState = createCommandMenuState({
      isOpen: true,
      activeCommandId: defaultCommandMenuCommandId()
    });
    this.timeOfDayState = createInitialTimeOfDayState(DEFAULT_TIME_OF_DAY_CONFIG);
    this.timeOfDayPalette = sampleTimeOfDayPalette(this.timeOfDayState);
    this.timeControlState = DEFAULT_TIME_CONTROL_STATE;
  }

  public create(): void {
    this.hud = new HudManager();
    this.cameras.main.setBackgroundColor(this.timeOfDayPalette.backgroundColor);
    this.layoutGrid();
    this.setupGridHoverHighlight();

    this.simConfig = createInteractiveClientSimConfig();
    const { worldGrid, worldCore } = bootstrapWorldForScene({
      simConfig: this.simConfig,
      timeOfDayState: this.timeOfDayState
    });
    this.worldGrid = worldGrid;
    const worldPort = new WorldCoreWorldPort(worldCore);

    this.gridGraphics = this.add.graphics();
    drawGridLines(this.gridGraphics, this.worldGrid, this.gridOriginX, this.gridOriginY, this.timeOfDayPalette);
    this.stoneGraphics = this.add.graphics();
    this.stoneGraphics.setDepth(12);
    drawStoneCellsToGraphics(
      this.stoneGraphics,
      this.worldGrid,
      this.gridOriginX,
      this.gridOriginY,
      this.worldGrid.blockedCellKeys ?? new Set()
    );
    this.interactionGraphics = this.add.graphics();
    drawInteractionPoints(
      this.interactionGraphics,
      this.interactionLabels,
      this,
      this.worldGrid,
      this.gridOriginX,
      this.gridOriginY,
      this.reservations,
      this.timeOfDayPalette
    );
    this.treeGraphics = this.add.graphics();
    this.treeGraphics.setDepth(13);
    this.buildingGraphics = this.add.graphics();
    this.buildingGraphics.setDepth(14);
    this.groundResourceGraphics = this.add.graphics();
    this.groundResourceGraphics.setDepth(31);
    this.zoneOverlayGraphics = this.add.graphics();
    this.zoneOverlayGraphics.setDepth(30);

    this.floorSelectionGraphics = this.add.graphics();
    /** 须高于树木（13），否则框选/拖动时预览环与填充会被树冠遮住（伐木最明显）。 */
    this.floorSelectionGraphics.setDepth(MAP_OVERLAY_DEPTH.floorSelection);
    this.floorSelectionDraftGraphics = this.add.graphics();
    this.floorSelectionDraftGraphics.setDepth(MAP_OVERLAY_DEPTH.floorSelectionDraft);
    this.taskMarkerGraphics = this.add.graphics();
    /** 高于选区草稿，保证已下达任务标记始终可读。 */
    this.taskMarkerGraphics.setDepth(MAP_OVERLAY_DEPTH.taskMarkerGraphics);
    syncTaskMarkerView(
      this.taskMarkerGraphics,
      this.taskMarkerTexts,
      this,
      this.taskMarkersByCell,
      this.worldGrid,
      this.gridOriginX,
      this.gridOriginY
    );

    const names =
      this.variant === "alt-en"
        ? pickRandomAltPawnNames(DEFAULT_PAWN_NAMES.length)
        : [...DEFAULT_PAWN_NAMES];
    this.pawns = createDefaultPawnStates(this.worldGrid.defaultSpawnPoints, names);
    this.reservations = createReservationSnapshot();
    this.views = createPawnViews(
      this,
      this.pawns,
      this.worldGrid,
      this.gridOriginX,
      this.gridOriginY,
      this.timeOfDayPalette
    );

    this.hud.setHoverInfoColor(this.timeOfDayPalette);
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);
    this.keyboard.setupTimeControls(
      this,
      this.hud,
      () => this.toggleTimePaused(),
      (s) => this.setTimeSpeed(s),
      () => this.pauseTime()
    );
    this.keyboard.setupCommandMenuHotkeys(this, (commandId) => this.selectCommandMenuCommand(commandId));
    this.hud.setupCommandMenu(
      (commandId) => this.selectCommandMenuCommand(commandId as CommandMenuCommandId),
      this.commandMenuState.activeCommandId,
      this.commandMenuState.activeCategoryId
    );
    this.hud.bindSceneVariantSelect(this.variant, (next) => {
      this.scene.restart({ variant: next });
    });
    this.runtimeLogSession.setOnDevNdjsonPathReady(() => {
      this.syncDebugPanel();
    });
    this.hud.setupDebugPanel({
      onToggleOpen: () => {
        this.debugPanelOpen = !this.debugPanelOpen;
        this.syncDebugPanel();
      },
      onTogglePause: () => {
        this.debugLogPaused = !this.debugLogPaused;
        this.debugPausedSeq = this.debugLogPaused
          ? (this.runtimeDebugLogStore.getEvents()[this.runtimeDebugLogStore.getEvents().length - 1]?.seq ?? null)
          : null;
        this.syncDebugPanel();
      },
      onClear: () => {
        this.runtimeDebugLogStore.clear();
        this.debugSelectedEntryId = null;
        this.debugPausedSeq = null;
        this.syncDebugPanel();
      },
      onFilterChange: (value) => {
        this.debugFilter = value;
        this.syncDebugPanel();
      },
      onFilterFocusChange: (focused) => {
        if (this.input.keyboard) {
          this.input.keyboard.enabled = !focused;
        }
      },
      onSelectEntry: (entryId) => {
        this.debugSelectedEntryId = entryId;
        this.syncDebugPanel();
      }
    });

    this.hud.setupYamlScenarioPanel([...ALL_SCENARIOS], (def) => {
      this.applyHeadlessScenarioDefinition(def);
    });

    this.orchestrator = new GameOrchestrator({
      worldPort,
      worldGrid: this.worldGrid,
      interactionTemplate: DEFAULT_INTERACTION_TEMPLATE_GRID,
      sim: {
        getPawns: () => this.pawns,
        setPawns: (next) => {
          this.pawns = next;
        },
        getReservations: () => this.reservations,
        setReservations: (next) => {
          this.reservations = next;
        },
        getTimeOfDayState: () => this.timeOfDayState,
        setTimeOfDayState: (next) => {
          this.timeOfDayState = next;
        },
        getTimeOfDayPalette: () => this.timeOfDayPalette,
        setTimeOfDayPalette: (next) => {
          this.timeOfDayPalette = next;
        },
        getTimeControlState: () => ({ ...this.timeControlState }),
        setTimeControlState: (next) => {
          this.timeControlState = { ...next };
        },
        getSimGridSyncState: () => this.simGridSyncState,
        setSimGridSyncState: (next) => {
          this.simGridSyncState = next;
        }
      },
      simConfig: this.simConfig,
      rng: () => Math.random(),
      hooks: {
        onPaletteChanged: () => this.applyTimeOfDayPalette(),
        syncTimeHud: () =>
          this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette),
        syncTreesAndGroundItems: () => this.syncTreesAndGroundLayer(),
        redrawStoneCells: () =>
          drawStoneCellsToGraphics(
            this.stoneGraphics,
            this.worldGrid,
            this.gridOriginX,
            this.gridOriginY,
            this.worldGrid.blockedCellKeys ?? new Set()
          ),
        redrawInteractionPoints: () =>
          drawInteractionPoints(
            this.interactionGraphics,
            this.interactionLabels,
            this,
            this.worldGrid,
            this.gridOriginX,
            this.gridOriginY,
            this.reservations,
            this.timeOfDayPalette
          ),
        syncPawnViews: () =>
          syncPawnViews(
            this.views,
            this.pawns,
            this.worldGrid,
            this.gridOriginX,
            this.gridOriginY,
            this.orchestrator.getWorldSimAccess().getWorld().workItems,
            this.simConfig.workItemAnchorDurationSec
          ),
        syncMarkerOverlay: () => this.syncMarkerOverlayWithWorld(),
        syncHoverFromPointer: () => this.syncHoverFromPointer(),
        syncPawnDetailPanel: () => this.syncPawnDetailPanel()
      }
    });

    let floor: GameSceneFloorInteraction;
    const floorHost = {
      scene: this,
      getFloorSelectionGraphics: () => this.floorSelectionGraphics,
      getFloorDraftGraphics: () => this.floorSelectionDraftGraphics,
      getWorldGrid: () => this.worldGrid,
      getGridOrigin: () => ({ ox: this.gridOriginX, oy: this.gridOriginY }),
      getOrchestrator: () => this.orchestrator,
      getHud: () => this.hud,
      getTaskMarkers: () => this.taskMarkersByCell,
      setTaskMarkers: (m: Map<string, string>) => {
        this.taskMarkersByCell = m;
      },
      getActiveCommandId: () => this.commandMenuState.activeCommandId,
      onRedrawSelection: () => {
        floor.redrawFloorSelectionAndBrush();
      },
      getTaskMarkerView: () => this.getTaskMarkerViewDeps()
    };
    floor = new GameSceneFloorInteraction(floorHost);
    this.floorInteraction = floor;
    this.floorInteraction.redrawFloorSelectionAndBrush();
    this.floorInteraction.bind();

    this.cameraControls = new GameSceneCameraControls(this, this.worldGrid.cellSizePx);
    this.cameraControls.bind();

    this.orchestrator.bootstrapSimulationGrid();
    this.syncTreesAndGroundLayer();
    this.syncPlayerChannelUi();
    this.setupPawnRosterUi();
    this.syncDebugPanel();

    this.keyboard.setupEsc(this, () => this.floorInteraction.cancelGesture());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  public update(_time: number, delta: number): void {
    const worldBefore = getWorldSnapshot(this.orchestrator.getWorldSimAccess().getWorld());
    this.orchestrator.tick(delta);
    if (this.orchestrator.didAdvanceSimulationLastTick()) {
      this.runtimeTickCount += 1;
      const worldAfter = getWorldSnapshot(this.orchestrator.getWorldSimAccess().getWorld());
      this.captureRuntimeDebugEntries(
        this.runtimeTickCount,
        this.orchestrator.getLastAiEvents(),
        this.orchestrator.getLastPawnDecisionTraces(),
        diffWorkLifecycleEvents(worldBefore, worldAfter)
      );
    }
    this.syncDebugPanel();
  }

  private syncTreesAndGroundLayer(): void {
    const world = this.orchestrator.getWorldSimAccess().getWorld();
    drawTreesToGraphics(
      this.treeGraphics,
      this.worldGrid,
      this.gridOriginX,
      this.gridOriginY,
      projectTreeSnapshotsForRender(world)
    );
    syncGroundResourceItems(
      this,
      this.groundResourceGraphics,
      this.groundResourceLabels,
      this.groundResourceCountLabels,
      this.worldGrid,
      this.gridOriginX,
      this.gridOriginY,
      world.entities.values()
    );
    drawZoneOverlaysToGraphics(
      this.zoneOverlayGraphics,
      this.storageZoneLabels,
      this.worldGrid,
      this.gridOriginX,
      this.gridOriginY,
      world.entities.values()
    );
    drawBuildingsAndBlueprintsToGraphics(
      this.buildingGraphics,
      this.worldGrid,
      this.gridOriginX,
      this.gridOriginY,
      world.entities.values()
    );
  }

  private getTaskMarkerViewDeps() {
    return {
      taskMarkerGraphics: this.taskMarkerGraphics,
      taskMarkerTexts: this.taskMarkerTexts,
      scene: this,
      worldGrid: this.worldGrid,
      gridOriginX: this.gridOriginX,
      gridOriginY: this.gridOriginY
    };
  }

  private layoutGrid(): void {
    const { width, height } = this.scale;
    const { columns, rows, cellSizePx } = DEFAULT_WORLD_GRID;
    const gridW = columns * cellSizePx;
    const gridH = rows * cellSizePx;
    this.gridOriginX = (width - gridW) / 2;
    this.gridOriginY = (height - gridH) / 2;
  }

  private setupGridHoverHighlight(): void {
    const cs = DEFAULT_WORLD_GRID.cellSizePx;
    const frame = this.add.rectangle(0, 0, cs - 2, cs - 2, 0x000000, 0);
    frame.setStrokeStyle(2, 0xe8c547, 1);
    frame.setDepth(80);
    frame.setVisible(false);
    this.hoverHighlightFrame = frame;
  }

  private applyTimeOfDayPalette(): void {
    const deps: TimeOfDayPalettePresentationDeps = {
      gridGraphics: this.gridGraphics,
      views: this.views,
      interactionLabels: this.interactionLabels,
      camera: this.cameras.main,
      hud: this.hud,
      worldGrid: this.worldGrid,
      gridOriginX: this.gridOriginX,
      gridOriginY: this.gridOriginY,
      timeOfDayPalette: this.timeOfDayPalette
    };
    applyTimeOfDayPaletteToScene(deps);
  }

  private syncHoverFromPointer(): void {
    syncHoverFromPointerState({
      camera: this.cameras.main,
      activePointer: this.input.activePointer,
      worldGrid: this.worldGrid,
      gridOriginX: this.gridOriginX,
      gridOriginY: this.gridOriginY,
      hoverHighlightFrame: this.hoverHighlightFrame,
      hud: this.hud,
      lastHoverKeyRef: this.lastHoverKeyRef,
      getWorld: () => this.orchestrator.getWorldSimAccess().getWorld()
    });
  }

  private syncMarkerOverlayWithWorld(): void {
    const merged = mergeMarkerOverlayIfChanged(this.orchestrator, this.taskMarkersByCell);
    if (!merged) return;
    this.taskMarkersByCell = merged;
    redrawTaskMarkers(this.taskMarkersByCell, this.getTaskMarkerViewDeps());
  }

  private syncPawnDetailPanel(): void {
    const pawn = this.selectedPawnId ? this.pawns.find((p) => p.id === this.selectedPawnId) : undefined;
    this.hud.syncPawnDetail(pawn, this.orchestrator.getWorldSimAccess().getWorld().workItems);
  }

  private toggleTimePaused(): void {
    this.timeControlState = { ...this.timeControlState, paused: !this.timeControlState.paused };
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);
  }

  private pauseTime(): void {
    if (this.timeControlState.paused) return;
    this.timeControlState = { ...this.timeControlState, paused: true };
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);
  }

  private setTimeSpeed(speed: TimeSpeed): void {
    this.timeControlState = { ...this.timeControlState, speed };
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);
  }

  private selectCommandMenuCommand(commandId: CommandMenuCommandId): void {
    this.commandMenuState = selectCommandMenuStateCommand(this.commandMenuState, commandId);
    this.hud.syncCommandMenuSelection(commandId);
    this.floorInteraction.resetForToolChange();
    this.syncPlayerChannelUi();
  }

  private setupPawnRosterUi(): void {
    this.hud.setupPawnRoster(this.pawns, (id) => this.selectPawnForRoster(id));
    const firstId = this.pawns[0]?.id ?? null;
    this.selectPawnForRoster(firstId);
  }

  private selectPawnForRoster(pawnId: string | null): void {
    this.selectedPawnId = pawnId;
    this.hud.syncRosterSelection(pawnId);
    this.syncPawnDetailPanel();
  }

  private syncPlayerChannelUi(): void {
    syncPlayerChannelHintLines(this.hud, this.orchestrator, this.commandMenuState.activeCommandId);
  }

  private captureRuntimeDebugEntries(
    tick: number,
    aiEvents: readonly string[],
    pawnDecisionTraces: readonly PawnDecisionTrace[],
    workLifecycleEvents: readonly WorkLifecycleTraceEvent[]
  ): void {
    const decisions = pawnDecisionTraces;
    const detailWorkSummary = workLifecycleEvents.map((event) => ({
      kind: event.kind,
      workItemId: event.workItemId,
      pawnId: event.pawnId,
      reason: event.reason
    }));

    if (decisions.length === 0 && workLifecycleEvents.length === 0 && aiEvents.length === 0) {
      return;
    }

    for (let index = 0; index < decisions.length; index += 1) {
      const decision = decisions[index]!;
      const text =
        aiEvents[index] ??
        `[tick ${tick}] ${decision.pawnName} ${decision.decisionSource} -> ${decision.selectedCandidate?.goal ?? decision.result.kind}`;
      const searchText = [
        text,
        decision.pawnName,
        decision.decisionSource,
        decision.selectedCandidate?.goal,
        decision.selectedCandidate?.reason,
        decision.result.kind,
        decision.result.blockedReason,
        decision.interruptReason
      ]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .join(" ")
        .toLowerCase();
      this.runtimeLogSession.log({
        tick,
        category: "AI.Decision",
        verbosity: "Log",
        message: text,
        detail: {
          tick,
          text,
          pawnDecision: decision,
          workLifecycleEvents: detailWorkSummary
        },
        searchTextParts: [searchText]
      });
    }

    if (decisions.length === 0 || workLifecycleEvents.length > 0) {
      const text =
        workLifecycleEvents.length > 0
          ? `[tick ${tick}] work events: ${workLifecycleEvents.map((event) => `${event.kind}:${event.workItemId}`).join(", ")}`
          : aiEvents[0] ?? `[tick ${tick}] runtime event`;
      this.runtimeLogSession.log({
        tick,
        category: workLifecycleEvents.length > 0 ? "Work.Lifecycle" : "System",
        verbosity: "Log",
        message: text,
        detail: {
          tick,
          text,
          workLifecycleEvents: detailWorkSummary
        },
        searchTextParts: [
          text,
          ...detailWorkSummary.flatMap((event) => [event.kind, event.workItemId, event.pawnId, event.reason])
        ]
      });
    }
  }

  private syncDebugPanel(): void {
    const pausedSeq = this.debugPausedSeq;
    const sourceEvents =
      this.debugLogPaused && pausedSeq !== null
        ? this.runtimeDebugLogStore.getEvents().filter((event) => event.seq <= pausedSeq)
        : this.runtimeDebugLogStore.getEvents();
    const entries = selectRuntimeDebugLogEntries(sourceEvents, this.debugFilter);
    if (this.debugSelectedEntryId === null && entries.length > 0) {
      this.debugSelectedEntryId = entries[entries.length - 1]?.id ?? null;
    }
    if (
      this.debugSelectedEntryId !== null &&
      !entries.some((entry) => entry.id === this.debugSelectedEntryId)
    ) {
      this.debugSelectedEntryId = entries[entries.length - 1]?.id ?? null;
    }
    this.hud.syncDebugPanel({
      open: this.debugPanelOpen,
      paused: this.debugLogPaused,
      filter: this.debugFilter,
      selectedEntryId: this.debugSelectedEntryId,
      entries,
      devNdjsonFilePath: this.runtimeLogSession.devNdjsonFilePath
    });
  }

  /**
   * 切换 YAML 场景前：集中做与「上一场景 / 本机开局地形」的解耦，等价于换一套模拟上下文。
   * 新增强制重置逻辑时优先放在这里，而不是散落在载入语句之间。
   *
   * - **`blockedCellKeys` 置空**：`syncWorldGridForSimulation` 会把墙体与障碍实体写回网格；若再叠「本局随机石格」，
   *   `seedBlockedCellsAsObstacles` 会先种一批石头实体，常与场景里写死的树/人出生格冲突（headless 从不带随机石头，浏览器却曾恢复它们）。
   *   YAML 热切换按**空地形**叠 `ScenarioDefinition`，载入后再由新世界同步回不可走格。
   * - **交互点**：恢复为与编排器 `interactionTemplate`（默认关卡样板）一致的列表。
   * - **同步游标**：`simGridSyncState` 置空，下一轮 `bootstrapSimulationGrid` 必须从 `WorldCore` 完整重算。
   */
  private cleanupRuntimeBeforeNextScenario(): void {
    const blocked = this.worldGrid.blockedCellKeys;
    if (blocked instanceof Set) {
      blocked.clear();
    } else {
      (this.worldGrid as WorldGridConfig & { blockedCellKeys: Set<string> }).blockedCellKeys = new Set();
    }
    (this.worldGrid as WorldGridConfig & { interactionPoints: InteractionPoint[] }).interactionPoints = [
      ...DEFAULT_SCENARIO_INTERACTION_POINTS
    ];
    this.simGridSyncState = null;
  }

  /**
   * 将 `scenarios/*.scenario.ts` 写入当前 WorldCore 与小人列表（不重启 Phaser 场景）。
   * `expectations` 不会自动判定，仅便于人工对照 Vitest 中的同一定义。
   *
   * 流程分三段：**清理** → **领域载入** → **表现与 HUD 对齐**。
   */
  private applyHeadlessScenarioDefinition(def: ScenarioDefinition): void {
    try {
      const port = this.orchestrator.getPlayerWorldPort();
      if (!(port instanceof WorldCoreWorldPort)) {
        window.alert("当前世界端口不是 WorldCoreWorldPort，无法载入测试场景。");
        return;
      }

      // --- 1) 切换前清理：与上一场景 runtime 解耦 ---
      this.cleanupRuntimeBeforeNextScenario();

      // --- 2) 领域载入：空白 baseline（不占上一场景实体），再叠场景定义 ---
      /** 不用当前 port 里的世界叠加载入，否则上一场景的实体仍占格会与新 pawn/蓝图冲突。 */
      const baselineWorld = seedBlockedCellsAsObstacles(
        createWorldCore({
          grid: this.worldGrid,
          timeState: {
            dayNumber: this.timeOfDayState.dayNumber,
            minuteOfDay: this.timeOfDayState.minuteOfDay
          },
          timeConfig: DEFAULT_TIME_OF_DAY_CONFIG
        }),
        this.worldGrid.blockedCellKeys ?? new Set()
      );
      const { world, pawnStates } = loadScenarioIntoGame(baselineWorld, def);
      port.setWorld(world);
      port.resetSession();

      destroyPawnViews(this.views);

      this.pawns = pawnStates.map((p) => ({ ...p }));
      this.reservations = createReservationSnapshot();

      const snap = port.getWorld().time;
      this.timeOfDayState = { dayNumber: snap.dayNumber, minuteOfDay: snap.minuteOfDay };
      this.timeOfDayPalette = sampleTimeOfDayPalette(this.timeOfDayState);

      this.orchestrator.bootstrapSimulationGrid();

      // --- 3) 表现与 HUD：视图、标绘、调试与工具条与新世界一致 ---
      this.views = createPawnViews(
        this,
        this.pawns,
        this.worldGrid,
        this.gridOriginX,
        this.gridOriginY,
        this.timeOfDayPalette
      );

      this.applyTimeOfDayPalette();
      this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);

      drawStoneCellsToGraphics(
        this.stoneGraphics,
        this.worldGrid,
        this.gridOriginX,
        this.gridOriginY,
        this.worldGrid.blockedCellKeys ?? new Set()
      );
      drawInteractionPoints(
        this.interactionGraphics,
        this.interactionLabels,
        this,
        this.worldGrid,
        this.gridOriginX,
        this.gridOriginY,
        this.reservations,
        this.timeOfDayPalette
      );
      this.syncTreesAndGroundLayer();

      this.taskMarkersByCell = new Map();
      redrawTaskMarkers(this.taskMarkersByCell, this.getTaskMarkerViewDeps());
      this.runtimeDebugLogStore.clear();
      this.debugSelectedEntryId = null;
      this.debugPausedSeq = null;
      this.runtimeTickCount = 0;
      this.runtimeLogSession.log({
        category: "Scenario",
        verbosity: "Display",
        message: `scenario switched: ${def.name}`,
        detail: {
          scenarioName: def.name,
          description: def.description
        },
        searchTextParts: [def.name, def.description]
      });
      this.syncDebugPanel();

      this.hud.setupPawnRoster(this.pawns, (id) => this.selectPawnForRoster(id));
      this.selectPawnForRoster(this.pawns[0]?.id ?? null);

      this.floorInteraction.redrawFloorSelectionAndBrush();
      this.syncPlayerChannelUi();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("applyHeadlessScenarioDefinition:", err);
      window.alert(`载入测试场景失败：${msg}`);
    }
  }

  private onShutdown(): void {
    void this.runtimeLogSession.flush();
    this.keyboard.teardownAll(this.hud);
    this.cameraControls.unbind();
    this.floorInteraction.unbind();
    this.hud.teardownAll();
    for (const t of this.groundResourceLabels.values()) {
      t.destroy();
    }
    for (const t of this.groundResourceCountLabels.values()) {
      t.destroy();
    }
    for (const t of this.storageZoneLabels.values()) {
      t.destroy();
    }
    this.groundResourceLabels.clear();
    this.groundResourceCountLabels.clear();
    this.storageZoneLabels.clear();
    this.interactionLabels.clear();
    this.taskMarkerTexts.clear();
    this.views.clear();
  }
}
