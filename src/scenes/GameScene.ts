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
import { bootstrapWorldForScene } from "../game/world-bootstrap";
import {
  createReservationSnapshot,
  DEFAULT_WORLD_GRID,
  type ReservationSnapshot,
  type WorldGridConfig
} from "../game/map";
import type { SimGridSyncState } from "../game/world-sim-bridge";
import { DEFAULT_SIM_CONFIG, type SimConfig } from "../game/behavior";
import {
  DEFAULT_PLAYER_ACCEPTANCE_SCENARIO_ID,
  PLAYER_ACCEPTANCE_SCENARIOS,
  playerAcceptanceScenarioById,
  resolveSimConfigForScenario
} from "../data/player-acceptance-scenarios";
import { HudManager } from "../ui/hud-manager";
import { VILLAGER_TOOLS } from "../data/villager-tools";
import {
  drawGridLines,
  drawStoneCellsToGraphics,
  drawInteractionPoints
} from "./renderers/grid-renderer";
import { createPawnViews, syncPawnViews, type PawnView } from "./renderers/pawn-renderer";
import { drawGroundItemStacks } from "./renderers/ground-items-renderer";
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
import {
  applyAcceptanceScenarioPresentation,
  runAcceptanceReplayPresentation
} from "./game-scene-acceptance-ui";

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

  private variant: GameSceneVariant = "default";
  private selectedToolIndex = 0;
  private selectedPawnId: string | null = null;
  private taskMarkersByCell = new Map<string, string>();

  private readonly keyboard = new GameSceneKeyboardBindings();

  private acceptanceScenarioId = DEFAULT_PLAYER_ACCEPTANCE_SCENARIO_ID;
  private simConfig: SimConfig = DEFAULT_SIM_CONFIG;
  private simGridSyncState: SimGridSyncState | null = null;
  private orchestrator!: GameOrchestrator;
  private floorInteraction!: GameSceneFloorInteraction;

  private hud!: HudManager;

  public constructor() {
    super("game");
  }

  public init(data: { variant?: string; acceptance?: string } = {}): void {
    this.variant = data.variant === "alt-en" ? "alt-en" : "default";
    const acc = data.acceptance;
    this.acceptanceScenarioId =
      typeof acc === "string" && playerAcceptanceScenarioById(acc)
        ? acc
        : DEFAULT_PLAYER_ACCEPTANCE_SCENARIO_ID;
    this.selectedToolIndex = 0;
    this.timeOfDayState = createInitialTimeOfDayState(DEFAULT_TIME_OF_DAY_CONFIG);
    this.timeOfDayPalette = sampleTimeOfDayPalette(this.timeOfDayState);
    this.timeControlState = DEFAULT_TIME_CONTROL_STATE;
  }

  public create(): void {
    this.hud = new HudManager();
    this.cameras.main.setBackgroundColor(this.timeOfDayPalette.backgroundColor);
    this.layoutGrid();
    this.setupGridHoverHighlight();

    const accScenario = playerAcceptanceScenarioById(this.acceptanceScenarioId);
    this.simConfig = resolveSimConfigForScenario(accScenario);
    const { worldGrid, worldPort } = bootstrapWorldForScene({
      scenario: accScenario,
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
    drawGroundItemStacks(this, this.worldGrid, this.gridOriginX, this.gridOriginY);

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
    this.hud.setupToolBar((i) => this.selectVillagerTool(i), this.selectedToolIndex);
    this.setupPawnRosterUi();
    this.hud.bindSceneVariantSelect(this.variant, (next) => {
      this.scene.restart({ variant: next, acceptance: this.acceptanceScenarioId });
    });
    this.hud.setupBAcceptancePanel(PLAYER_ACCEPTANCE_SCENARIOS, this.acceptanceScenarioId, {
      onScenarioChange: (id) => this.scene.restart({ variant: this.variant, acceptance: id }),
      onReplay: () => this.runAcceptanceReplay()
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
          syncPawnViews(this.views, this.pawns, this.worldGrid, this.gridOriginX, this.gridOriginY),
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
      onRedrawSelection: () => {
        floor.redrawFloorSelectionAndBrush();
      },
      getTaskMarkerView: () => this.getTaskMarkerViewDeps()
    };
    floor = new GameSceneFloorInteraction(floorHost);
    this.floorInteraction = floor;
    this.floorInteraction.redrawFloorSelectionAndBrush();
    this.floorInteraction.bind();

    this.applyAcceptanceScenario(this.acceptanceScenarioId);
    this.orchestrator.bootstrapSimulationGrid();
    this.syncPlayerChannelUi();

    this.keyboard.setupEsc(this, () => this.floorInteraction.cancelGesture());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  public update(_time: number, delta: number): void {
    this.orchestrator.tick(delta);
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
    this.hud.syncPawnDetail(pawn);
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
    this.hud.syncToolBarSelection(index);
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
    syncPlayerChannelHintLines(this.hud, this.orchestrator, this.selectedToolIndex, this.acceptanceScenarioId);
  }

  private applyAcceptanceScenario(scenarioId: string): void {
    applyAcceptanceScenarioPresentation({
      scenarioId,
      orchestrator: this.orchestrator,
      hud: this.hud,
      taskMarkersByCell: this.taskMarkersByCell,
      getTaskMarkerView: () => this.getTaskMarkerViewDeps(),
      floorInteraction: this.floorInteraction,
      onScenarioIdCommitted: (id) => {
        this.acceptanceScenarioId = id;
      },
      syncPlayerChannelUi: () => this.syncPlayerChannelUi()
    });
  }

  private runAcceptanceReplay(): void {
    runAcceptanceReplayPresentation({
      orchestrator: this.orchestrator,
      hud: this.hud,
      taskMarkersByCell: this.taskMarkersByCell,
      getTaskMarkerView: () => this.getTaskMarkerViewDeps()
    });
  }

  private onShutdown(): void {
    this.keyboard.teardownAll(this.hud);
    this.floorInteraction.unbind();
    this.hud.teardownAll();
    this.interactionLabels.clear();
    this.taskMarkerTexts.clear();
    this.views.clear();
  }
}
