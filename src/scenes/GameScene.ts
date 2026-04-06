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
  sampleTimeOfDayPalette,
  type TimeControlState,
  type TimeOfDayPalette,
  type TimeOfDayState,
  type TimeSpeed
} from "../game/time";
import { GameOrchestrator } from "../game/game-orchestrator";
import type { OrchestratorWorldBridge } from "../game/orchestrator-world-bridge";
import { bootstrapWorldForScene } from "../game/world-bootstrap";
import { createWorldCore } from "../game/world-core";
import {
  createReservationSnapshot,
  DEFAULT_WORLD_GRID,
  seedBlockedCellsAsObstacles,
  type ReservationSnapshot,
  type WorldGridConfig
} from "../game/map";
import type { SimGridSyncState } from "../game/world-sim-bridge";
import { DEFAULT_SIM_CONFIG, type SimConfig } from "../game/behavior";
import { HudManager } from "../ui/hud-manager";
import { VILLAGER_TOOLS, type VillagerBuildSubId } from "../data/villager-tools";
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
import { listAvailableScenarios, loadScenarioIntoGame } from "../player/scenario-loader";
import { WorldCoreWorldPort } from "../player/world-core-world-port";
import type { ScenarioDefinition } from "../headless/scenario-types";
import { getWorldSnapshot } from "../game/world-core";
import {
  diffWorkLifecycleEvents,
  type PawnDecisionTrace,
  type WorkLifecycleTraceEvent
} from "../headless/sim-debug-trace";
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

  private variant: GameSceneVariant = "default";
  private selectedToolIndex = 0;
  /** 仅当主工具为 `build` 时有效；选中主槽后须再选木墙/木床。 */
  private buildSubTool: VillagerBuildSubId | null = null;
  private selectedPawnId: string | null = null;
  private taskMarkersByCell = new Map<string, string>();

  private readonly keyboard = new GameSceneKeyboardBindings();

  private simConfig: SimConfig = DEFAULT_SIM_CONFIG;
  private simGridSyncState: SimGridSyncState | null = null;
  private orchestrator!: GameOrchestrator;
  private floorInteraction!: GameSceneFloorInteraction;

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
    this.selectedToolIndex = 0;
    this.buildSubTool = null;
    this.timeOfDayState = createInitialTimeOfDayState(DEFAULT_TIME_OF_DAY_CONFIG);
    this.timeOfDayPalette = sampleTimeOfDayPalette(this.timeOfDayState);
    this.timeControlState = DEFAULT_TIME_CONTROL_STATE;
  }

  public create(): void {
    this.hud = new HudManager();
    this.cameras.main.setBackgroundColor(this.timeOfDayPalette.backgroundColor);
    this.layoutGrid();
    this.setupGridHoverHighlight();

    this.simConfig = DEFAULT_SIM_CONFIG;
    const { worldGrid, worldPort } = bootstrapWorldForScene({
      simConfig: this.simConfig,
      timeOfDayState: this.timeOfDayState
    });
    this.worldGrid = worldGrid;

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
    this.groundResourceGraphics.setDepth(25);
    this.zoneOverlayGraphics = this.add.graphics();
    this.zoneOverlayGraphics.setDepth(30);

    this.floorSelectionGraphics = this.add.graphics();
    this.floorSelectionDraftGraphics = this.add.graphics();
    this.taskMarkerGraphics = this.add.graphics();
    this.taskMarkerGraphics.setDepth(35);
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
    this.keyboard.setupTimeControls(this, this.hud, () => this.toggleTimePaused(), (s) => this.setTimeSpeed(s));
    this.keyboard.setupVillagerToolBarKeys(this, (i) => this.selectVillagerTool(i));
    this.hud.setupToolBar(
      (i) => this.selectVillagerTool(i),
      this.selectedToolIndex,
      {
        onSelectSub: (sub) => this.selectBuildSubTool(sub),
        initialSub: this.buildSubTool
      }
    );
    this.hud.bindSceneVariantSelect(this.variant, (next) => {
      this.scene.restart({ variant: next });
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

    this.hud.setupYamlScenarioPanel(listAvailableScenarios(), (def) => {
      this.applyHeadlessScenarioDefinition(def);
    });

    this.orchestrator = new GameOrchestrator({
      worldPort,
      worldGrid: this.worldGrid,
      interactionTemplate: DEFAULT_WORLD_GRID,
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
        getTimeControlState: () => this.timeControlState,
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
            (this.orchestrator.getPlayerWorldPort() as OrchestratorWorldBridge).getWorld().workItems
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
      getSelectedToolIndex: () => this.selectedToolIndex,
      getBuildSubTool: () => this.buildSubTool,
      onRedrawSelection: () => {
        floor.redrawFloorSelectionAndBrush();
      },
      getTaskMarkerView: () => this.getTaskMarkerViewDeps()
    };
    floor = new GameSceneFloorInteraction(floorHost);
    this.floorInteraction = floor;
    this.floorInteraction.redrawFloorSelectionAndBrush();
    this.floorInteraction.bind();

    this.orchestrator.bootstrapSimulationGrid();
    this.syncTreesAndGroundLayer();
    this.syncPlayerChannelUi();
    this.setupPawnRosterUi();
    this.syncDebugPanel();

    this.keyboard.setupEsc(this, () => this.floorInteraction.cancelGesture());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  public update(_time: number, delta: number): void {
    const worldBefore = getWorldSnapshot(
      (this.orchestrator.getPlayerWorldPort() as OrchestratorWorldBridge).getWorld()
    );
    this.orchestrator.tick(delta);
    if (this.orchestrator.didAdvanceSimulationLastTick()) {
      this.runtimeTickCount += 1;
      const worldAfter = getWorldSnapshot(
        (this.orchestrator.getPlayerWorldPort() as OrchestratorWorldBridge).getWorld()
      );
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
    const port = this.orchestrator.getPlayerWorldPort() as OrchestratorWorldBridge;
    const world = port.getWorld();
    drawTreesToGraphics(
      this.treeGraphics,
      this.worldGrid,
      this.gridOriginX,
      this.gridOriginY,
      world.entities.values()
    );
    syncGroundResourceItems(
      this,
      this.groundResourceGraphics,
      this.groundResourceLabels,
      this.worldGrid,
      this.gridOriginX,
      this.gridOriginY,
      world.entities.values()
    );
    drawZoneOverlaysToGraphics(
      this.zoneOverlayGraphics,
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
      lastHoverKeyRef: this.lastHoverKeyRef
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
    const port = this.orchestrator.getPlayerWorldPort() as OrchestratorWorldBridge;
    this.hud.syncPawnDetail(pawn, port.getWorld().workItems);
  }

  private toggleTimePaused(): void {
    this.timeControlState = { ...this.timeControlState, paused: !this.timeControlState.paused };
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);
  }

  private setTimeSpeed(speed: TimeSpeed): void {
    this.timeControlState = { ...this.timeControlState, speed };
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);
  }

  private selectVillagerTool(index: number): void {
    if (index < 0 || index >= VILLAGER_TOOLS.length) return;
    this.selectedToolIndex = index;
    this.buildSubTool = null;
    this.hud.syncToolBarSelection(index, this.buildSubTool);
    this.floorInteraction.resetForToolChange();
    this.syncPlayerChannelUi();
  }

  private selectBuildSubTool(sub: VillagerBuildSubId): void {
    if (VILLAGER_TOOLS[this.selectedToolIndex]?.id !== "build") return;
    this.buildSubTool = sub;
    this.hud.syncToolBarSelection(this.selectedToolIndex, this.buildSubTool);
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
    syncPlayerChannelHintLines(this.hud, this.orchestrator, this.selectedToolIndex, this.buildSubTool);
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
      entries
    });
  }

  /**
   * 将 `scenarios/*.scenario.ts` 写入当前 WorldCore 与小人列表（不重启 Phaser 场景）。
   * `expectations` 不会自动判定，仅便于人工对照 Vitest 中的同一定义。
   */
  private applyHeadlessScenarioDefinition(def: ScenarioDefinition): void {
    try {
      const port = this.orchestrator.getPlayerWorldPort();
      if (!(port instanceof WorldCoreWorldPort)) {
        window.alert("当前世界端口不是 WorldCoreWorldPort，无法载入测试场景。");
        return;
      }
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
    this.floorInteraction.unbind();
    this.hud.teardownAll();
    for (const t of this.groundResourceLabels.values()) {
      t.destroy();
    }
    this.groundResourceLabels.clear();
    this.interactionLabels.clear();
    this.taskMarkerTexts.clear();
    this.views.clear();
  }
}
