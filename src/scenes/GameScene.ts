import Phaser from "phaser";
import {
  beginFloorSelection,
  clearFloorSelection,
  commitFloorSelection,
  createFloorSelectionState,
  handleOutsidePointerDown,
  resolveSelectionModifier,
  updateFloorSelection,
  type FloorSelectionState,
  type SelectionModifier
} from "../game/floor-selection";
import {
  createDefaultPawnStates,
  DEFAULT_PAWN_NAMES,
  logicalCellsByPawnId,
  pickRandomAltPawnNames,
  type PawnState
} from "../game/pawn-state";
import {
  DEFAULT_TIME_CONTROL_STATE,
  DEFAULT_TIME_OF_DAY_CONFIG,
  createInitialTimeOfDayState,
  effectiveSimulationDeltaSeconds,
  sampleTimeOfDayPalette,
  type TimeControlState,
  type TimeOfDayPalette,
  type TimeSpeed,
  type TimeOfDayState
} from "../game/time-of-day";
import {
  advanceWorldClock,
  createWorldCore,
  getWorldSnapshot
} from "../game/world-core";
import { seedBlockedCellsAsObstacles } from "../game/world-core-seed";
import {
  blockedKeysFromCells,
  cellAtWorldPixel,
  coordKey,
  createReservationSnapshot,
  DEFAULT_WORLD_GRID,
  parseCoordKey,
  pickRandomBlockedCells,
  pruneReservationSnapshot,
  type GridCoord,
  type ReservationSnapshot,
  type WorldGridConfig
} from "../game/world-grid";
import {
  syncWorldGridForSimulation,
  type SimGridSyncState
} from "../game/world-sim-bridge";
import { DEFAULT_SIM_CONFIG, type SimConfig } from "../game/sim-config";
import { tickSimulation } from "../game/sim-loop";
import { formatGridCellHoverText } from "../data/grid-cell-info";
import { taskMarkerMapsEqual } from "../data/task-markers";
import {
  DEFAULT_PLAYER_ACCEPTANCE_SCENARIO_ID,
  PLAYER_ACCEPTANCE_SCENARIOS,
  playerAcceptanceScenarioById,
  resolveSimConfigForScenario,
  scenarioToMockWorldPortConfig
} from "../data/player-acceptance-scenarios";
import { HudManager } from "../ui/hud-manager";
import { VILLAGER_TOOLS, VILLAGER_TOOL_KEY_CODES } from "../data/villager-tools";
import {
  commitPlayerSelectionToWorld,
  rebuildTaskMarkersFromCommandResults
} from "../player/commit-player-intent";
import { presentationForVillagerTool } from "../player/interaction-mode-presenter";
import {
  beginBrushStroke,
  endBrushStroke,
  extendBrushStroke,
  inactiveBrushStroke,
  type BrushStrokeState
} from "../player/brush-stroke";
import { WorldCoreWorldPort } from "../player/world-core-world-port";
import {
  drawGridLines,
  drawStoneCellsToGraphics,
  drawInteractionPoints
} from "./renderers/grid-renderer";
import { createPawnViews, syncPawnViews, applyPaletteToViews, type PawnView } from "./renderers/pawn-renderer";
import { drawGroundItemStacks } from "./renderers/ground-items-renderer";
import {
  drawSelectionOverlay,
  redrawFloorSelection,
  syncTaskMarkerView
} from "./renderers/selection-renderer";

export type GameSceneVariant = "default" | "alt-en";

export class GameScene extends Phaser.Scene {
  // Layout
  private gridOriginX = 0;
  private gridOriginY = 0;
  private worldGrid: WorldGridConfig = DEFAULT_WORLD_GRID;

  // Simulation state
  private pawns: PawnState[] = [];
  private reservations: ReservationSnapshot = createReservationSnapshot();
  private timeOfDayState: TimeOfDayState = createInitialTimeOfDayState(DEFAULT_TIME_OF_DAY_CONFIG);
  private timeOfDayPalette: TimeOfDayPalette = sampleTimeOfDayPalette(
    createInitialTimeOfDayState(DEFAULT_TIME_OF_DAY_CONFIG)
  );
  private timeControlState: TimeControlState = DEFAULT_TIME_CONTROL_STATE;

  // Phaser renderables
  private views = new Map<string, PawnView>();
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private stoneGraphics!: Phaser.GameObjects.Graphics;
  private interactionGraphics!: Phaser.GameObjects.Graphics;
  private interactionLabels = new Map<string, Phaser.GameObjects.Text>();
  private hoverHighlightFrame!: Phaser.GameObjects.Rectangle;
  private lastHoverKey: string | null = "\0";
  private floorSelectionGraphics!: Phaser.GameObjects.Graphics;
  private floorSelectionDraftGraphics!: Phaser.GameObjects.Graphics;
  private taskMarkerGraphics!: Phaser.GameObjects.Graphics;
  private taskMarkerTexts = new Map<string, Phaser.GameObjects.Text>();

  // Input / selection state
  private variant: GameSceneVariant = "default";
  private floorSelectionState: FloorSelectionState = createFloorSelectionState();
  private activeSelectionPointerId?: number;
  private selectedToolIndex = 0;
  private selectedPawnId: string | null = null;
  private taskMarkersByCell = new Map<string, string>();

  // Keyboard key objects (for cleanup)
  private toolKeyObjects: Phaser.Input.Keyboard.Key[] = [];
  private timeControlKeyObjects: Phaser.Input.Keyboard.Key[] = [];
  private escKeyObject: Phaser.Input.Keyboard.Key | null = null;
  private timeControlAbort: AbortController | null = null;

  // 领域命令经 WorldCore 网关 + 建造笔刷
  private worldPort!: WorldCoreWorldPort;
  private brushState: BrushStrokeState = inactiveBrushStroke();
  private brushGestureModifier: SelectionModifier = "replace";
  private acceptanceScenarioId = DEFAULT_PLAYER_ACCEPTANCE_SCENARIO_ID;
  private simConfig: SimConfig = DEFAULT_SIM_CONFIG;
  private simGridSyncState: SimGridSyncState | null = null;

  // HUD manager
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

    // Build world grid with random blocked cells
    const excludeSpawn = blockedKeysFromCells(DEFAULT_WORLD_GRID.defaultSpawnPoints);
    const forcedBlockedKeys = accScenario?.forcedBlockedCellKeys ?? [];
    const stoneCellsRandom = pickRandomBlockedCells(
      DEFAULT_WORLD_GRID,
      this.simConfig.stoneCellCount,
      excludeSpawn,
      () => Math.random()
    );
    const stoneCells = [...stoneCellsRandom];
    for (const fk of forcedBlockedKeys) {
      const p = parseCoordKey(fk);
      if (!p) continue;
      if (!stoneCells.some((s) => s.col === p.col && s.row === p.row)) {
        stoneCells.push(p);
      }
    }
    this.worldGrid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: new Set([...blockedKeysFromCells(stoneCells), ...forcedBlockedKeys])
    };

    const worldCore = seedBlockedCellsAsObstacles(
      createWorldCore({
        grid: this.worldGrid,
        timeState: { dayNumber: this.timeOfDayState.dayNumber, minuteOfDay: this.timeOfDayState.minuteOfDay },
        timeConfig: DEFAULT_TIME_OF_DAY_CONFIG
      }),
      this.worldGrid.blockedCellKeys ?? new Set()
    );
    this.worldPort = new WorldCoreWorldPort(worldCore);

    // Grid graphics
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
      this.interactionGraphics, this.interactionLabels, this,
      this.worldGrid, this.gridOriginX, this.gridOriginY,
      this.reservations, this.timeOfDayPalette
    );
    drawGroundItemStacks(this, this.worldGrid, this.gridOriginX, this.gridOriginY);

    // Selection graphics
    this.floorSelectionGraphics = this.add.graphics();
    this.floorSelectionDraftGraphics = this.add.graphics();
    this.floorSelectionState = createFloorSelectionState();
    this.activeSelectionPointerId = undefined;
    this.redrawSelectionAndBrush();

    // Task marker graphics
    this.taskMarkerGraphics = this.add.graphics();
    this.taskMarkerGraphics.setDepth(35);
    syncTaskMarkerView(
      this.taskMarkerGraphics, this.taskMarkerTexts, this,
      this.taskMarkersByCell, this.worldGrid, this.gridOriginX, this.gridOriginY
    );

    // Spawn pawns
    const names =
      this.variant === "alt-en"
        ? pickRandomAltPawnNames(DEFAULT_PAWN_NAMES.length)
        : [...DEFAULT_PAWN_NAMES];
    this.pawns = createDefaultPawnStates(this.worldGrid.defaultSpawnPoints, names);
    this.reservations = createReservationSnapshot();
    this.views = createPawnViews(
      this, this.pawns, this.worldGrid, this.gridOriginX, this.gridOriginY, this.timeOfDayPalette
    );

    // HUD setup
    this.hud.setHoverInfoColor(this.timeOfDayPalette);
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);
    this.setupTimeControls();
    this.setupVillagerToolBarKeys();
    this.hud.setupToolBar((i) => this.selectVillagerTool(i), this.selectedToolIndex);
    this.setupPawnRosterUi();
    this.hud.bindSceneVariantSelect(this.variant, (next) => {
      this.scene.restart({ variant: next, acceptance: this.acceptanceScenarioId });
    });
    this.hud.setupBAcceptancePanel(PLAYER_ACCEPTANCE_SCENARIOS, this.acceptanceScenarioId, {
      onScenarioChange: (id) => this.scene.restart({ variant: this.variant, acceptance: id }),
      onReplay: () => this.runAcceptanceReplay()
    });
    this.applyAcceptanceScenario(this.acceptanceScenarioId);
    this.refreshSimulationGridFromWorldCore(true);
    this.syncPlayerChannelUi();

    this.bindFloorSelectionInput();
    this.setupInteractionCancelKey();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  public update(_time: number, delta: number): void {
    const realDt = delta / 1000;
    const simulationDt = effectiveSimulationDeltaSeconds(realDt, this.timeControlState);

    const clock = advanceWorldClock(this.worldPort.getWorld(), simulationDt, this.timeControlState);
    this.worldPort.setWorld(clock.world);
    this.refreshSimulationGridFromWorldCore(false);
    const snapshotTime = getWorldSnapshot(clock.world).time;
    const nextTimeState: TimeOfDayState = {
      dayNumber: snapshotTime.dayNumber,
      minuteOfDay: snapshotTime.minuteOfDay
    };
    const nextPalette = sampleTimeOfDayPalette(nextTimeState);
    const paletteChanged = !sameTimeOfDayPalette(this.timeOfDayPalette, nextPalette);
    this.timeOfDayState = nextTimeState;
    if (paletteChanged) {
      this.timeOfDayPalette = nextPalette;
      this.applyTimeOfDayPalette();
    }
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);

    if (simulationDt <= 0) {
      this.syncMarkerOverlayWithWorld();
      this.syncHoverFromPointer();
      this.syncPawnDetailPanel();
      return;
    }

    // Run simulation tick
    const result = tickSimulation({
      pawns: this.pawns,
      reservations: this.reservations,
      grid: this.worldGrid,
      simulationDt,
      config: this.simConfig,
      rng: () => Math.random()
    });

    for (const msg of result.aiEvents) {
      console.info(msg);
    }

    this.reservations = result.reservations;
    this.pawns = [...result.pawns];

    drawInteractionPoints(
      this.interactionGraphics, this.interactionLabels, this,
      this.worldGrid, this.gridOriginX, this.gridOriginY,
      this.reservations, this.timeOfDayPalette
    );
    syncPawnViews(this.views, this.pawns, this.worldGrid, this.gridOriginX, this.gridOriginY);
    this.syncMarkerOverlayWithWorld();
    this.syncHoverFromPointer();
    this.syncPawnDetailPanel();
  }

  // ── Layout ────────────────────────────────────────────────

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

  // ── Palette application ───────────────────────────────────

  private applyTimeOfDayPalette(): void {
    this.cameras.main.setBackgroundColor(this.timeOfDayPalette.backgroundColor);
    drawGridLines(this.gridGraphics, this.worldGrid, this.gridOriginX, this.gridOriginY, this.timeOfDayPalette);
    applyPaletteToViews(this.views, this.timeOfDayPalette);
    const secondaryColor = `#${(this.timeOfDayPalette.secondaryTextColor & 0xffffff).toString(16).padStart(6, "0")}`;
    for (const label of this.interactionLabels.values()) {
      if (label.active) label.setColor(secondaryColor);
    }
    this.hud.setHoverInfoColor(this.timeOfDayPalette);
  }

  // ── Hover sync ────────────────────────────────────────────

  /**
   * 把 WorldCore 障碍实体与休息床位同步到与领域共用的 `worldGrid`，并视需重画石头格、清理失效交互点预订。
   */
  private refreshSimulationGridFromWorldCore(forceRedrawStones: boolean): void {
    const world = this.worldPort.getWorld();
    const { blockedChanged, interactionChanged, next } = syncWorldGridForSimulation(
      this.worldGrid,
      world,
      DEFAULT_WORLD_GRID,
      this.simGridSyncState
    );
    this.simGridSyncState = next;

    if (blockedChanged || forceRedrawStones) {
      drawStoneCellsToGraphics(
        this.stoneGraphics,
        this.worldGrid,
        this.gridOriginX,
        this.gridOriginY,
        this.worldGrid.blockedCellKeys ?? new Set()
      );
    }

    if (interactionChanged) {
      const ids = new Set(this.worldGrid.interactionPoints.map((p) => p.id));
      this.reservations = pruneReservationSnapshot(this.reservations, ids);
    }
  }

  private syncHoverFromPointer(): void {
    const ptr = this.input.activePointer;
    const cam = this.cameras.main;
    const w = cam.getWorldPoint(ptr.x, ptr.y);
    const cell = cellAtWorldPixel(this.worldGrid, this.gridOriginX, this.gridOriginY, w.x, w.y);
    const key = cell ? coordKey(cell) : null;
    if (key === this.lastHoverKey) return;
    this.lastHoverKey = key;

    if (!cell) {
      this.hoverHighlightFrame.setVisible(false);
      this.hud.hideHoverInfo();
      return;
    }

    const cs = this.worldGrid.cellSizePx;
    const cx = this.gridOriginX + cell.col * cs + cs / 2;
    const cy = this.gridOriginY + cell.row * cs + cs / 2;
    this.hoverHighlightFrame.setPosition(cx, cy);
    this.hoverHighlightFrame.setSize(cs - 2, cs - 2);
    this.hoverHighlightFrame.setVisible(true);
    this.hud.showHoverInfo(formatGridCellHoverText(cell, this.worldGrid));
  }

  // ── Pawn detail ───────────────────────────────────────────

  private syncMarkerOverlayWithWorld(): void {
    const merged = this.worldPort.mergeTaskMarkerOverlayWithWorld(this.taskMarkersByCell);
    if (!taskMarkerMapsEqual(merged, this.taskMarkersByCell)) {
      this.taskMarkersByCell = merged;
      syncTaskMarkerView(
        this.taskMarkerGraphics,
        this.taskMarkerTexts,
        this,
        this.taskMarkersByCell,
        this.worldGrid,
        this.gridOriginX,
        this.gridOriginY
      );
    }
  }

  private syncPawnDetailPanel(): void {
    const pawn = this.selectedPawnId
      ? this.pawns.find((p) => p.id === this.selectedPawnId)
      : undefined;
    this.hud.syncPawnDetail(pawn);
  }

  // ── Time controls ─────────────────────────────────────────

  private setupTimeControls(): void {
    this.teardownTimeControls();
    this.timeControlAbort = this.hud.setupTimeControls({
      onTogglePause: () => this.toggleTimePaused(),
      onSetSpeed: (s) => this.setTimeSpeed(s)
    });

    if (this.input.keyboard) {
      const bindings: ReadonlyArray<readonly [number, () => void]> = [
        [Phaser.Input.Keyboard.KeyCodes.SPACE, () => this.toggleTimePaused()],
        [Phaser.Input.Keyboard.KeyCodes.ONE, () => this.setTimeSpeed(1)],
        [Phaser.Input.Keyboard.KeyCodes.TWO, () => this.setTimeSpeed(2)],
        [Phaser.Input.Keyboard.KeyCodes.THREE, () => this.setTimeSpeed(3)]
      ];
      for (const [code, handler] of bindings) {
        const key = this.input.keyboard.addKey(code);
        key.on("down", handler);
        this.timeControlKeyObjects.push(key);
      }
    }
  }

  private teardownTimeControls(): void {
    this.timeControlAbort?.abort();
    this.timeControlAbort = null;
    for (const key of this.timeControlKeyObjects) key.destroy();
    this.timeControlKeyObjects = [];
  }

  private toggleTimePaused(): void {
    this.timeControlState = { ...this.timeControlState, paused: !this.timeControlState.paused };
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);
  }

  private setTimeSpeed(speed: TimeSpeed): void {
    this.timeControlState = { ...this.timeControlState, speed };
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);
  }

  // ── Villager tool bar ─────────────────────────────────────

  private setupVillagerToolBarKeys(): void {
    if (!this.input.keyboard) return;
    for (let i = 0; i < VILLAGER_TOOL_KEY_CODES.length; i++) {
      const code = VILLAGER_TOOL_KEY_CODES[i]!;
      const key = this.input.keyboard.addKey(code);
      key.on("down", () => this.selectVillagerTool(i));
      this.toolKeyObjects.push(key);
    }
  }

  private teardownVillagerToolBarKeys(): void {
    for (const k of this.toolKeyObjects) k.destroy();
    this.toolKeyObjects = [];
  }

  private selectVillagerTool(index: number): void {
    if (index < 0 || index >= VILLAGER_TOOLS.length) return;
    this.selectedToolIndex = index;
    this.hud.syncToolBarSelection(index);
    this.brushState = inactiveBrushStroke();
    this.activeSelectionPointerId = undefined;
    this.floorSelectionState = {
      selectedCellKeys: new Set(this.floorSelectionState.selectedCellKeys)
    };
    this.redrawSelectionAndBrush();
    this.syncPlayerChannelUi();
  }

  private selectedVillagerToolId(): string {
    return VILLAGER_TOOLS[this.selectedToolIndex]?.id ?? "idle";
  }

  // ── Pawn roster ───────────────────────────────────────────

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

  // ── Floor selection input ─────────────────────────────────

  private bindFloorSelectionInput(): void {
    this.input.off("pointerdown", this.handleFloorPointerDown, this);
    this.input.off("pointermove", this.handleFloorPointerMove, this);
    this.input.off("pointerup", this.handleFloorPointerUp, this);
    this.input.on("pointerdown", this.handleFloorPointerDown, this);
    this.input.on("pointermove", this.handleFloorPointerMove, this);
    this.input.on("pointerup", this.handleFloorPointerUp, this);
  }

  private handleFloorPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.leftButtonDown()) return;
    const modifier = resolveSelectionModifier(this.pointerHasShift(pointer), this.pointerHasCtrl(pointer));
    const cell = this.pointerCell(pointer);

    if (!cell) {
      this.floorSelectionState = handleOutsidePointerDown(this.floorSelectionState, modifier);
      this.activeSelectionPointerId = undefined;
      this.brushState = inactiveBrushStroke();
      this.redrawSelectionAndBrush();
      return;
    }

    if (this.selectedVillagerToolId() === "build") {
      this.brushGestureModifier = modifier;
      this.brushState = beginBrushStroke(pointer.id, this.worldGrid, cell);
      this.activeSelectionPointerId = pointer.id;
      this.redrawSelectionAndBrush();
      return;
    }

    this.floorSelectionState = beginFloorSelection(this.floorSelectionState, this.worldGrid, cell, modifier);
    this.activeSelectionPointerId = pointer.id;
    this.redrawSelectionAndBrush();
  }

  private handleFloorPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.activeSelectionPointerId !== pointer.id || !pointer.isDown) return;

    if (this.brushState.active) {
      const cell = this.pointerCell(pointer, true);
      this.brushState = extendBrushStroke(this.worldGrid, this.brushState, pointer.id, cell);
      this.redrawSelectionAndBrush();
      return;
    }

    if (!this.floorSelectionState.draft) return;
    const cell = this.pointerCell(pointer, true);
    if (!cell) return;
    this.floorSelectionState = updateFloorSelection(this.floorSelectionState, this.worldGrid, cell);
    this.redrawSelectionAndBrush();
  }

  private handleFloorPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.activeSelectionPointerId !== pointer.id) return;

    if (this.brushState.active) {
      const keys = endBrushStroke(this.brushState);
      this.brushState = inactiveBrushStroke();
      this.activeSelectionPointerId = undefined;
      this.redrawSelectionAndBrush();
      if (keys.size === 0) return;

      const brushOutcome = commitPlayerSelectionToWorld(this.worldPort, {
        toolId: "build",
        selectionModifier: this.brushGestureModifier,
        cellKeys: keys,
        inputShape: "brush-stroke",
        currentMarkers: this.taskMarkersByCell,
        nowMs: performance.now()
      });
      this.taskMarkersByCell = brushOutcome.nextMarkers;
      syncTaskMarkerView(
        this.taskMarkerGraphics, this.taskMarkerTexts, this,
        this.taskMarkersByCell, this.worldGrid, this.gridOriginX, this.gridOriginY
      );
      if (brushOutcome.resultSummaryLine !== null) {
        this.hud.syncPlayerChannelLastResult(brushOutcome.resultSummaryLine);
      }
      return;
    }

    const cell = this.pointerCell(pointer, true);
    if (cell && this.floorSelectionState.draft) {
      this.floorSelectionState = updateFloorSelection(this.floorSelectionState, this.worldGrid, cell);
    }
    const draft = this.floorSelectionState.draft;
    this.floorSelectionState = commitFloorSelection(this.floorSelectionState);
    this.activeSelectionPointerId = undefined;
    this.redrawSelectionAndBrush();

    if (!draft) return;
    const shape =
      draft.cellKeys.size === 1 ? ("single-cell" as const) : ("rect-selection" as const);
    const rectOutcome = commitPlayerSelectionToWorld(this.worldPort, {
      toolId: this.selectedVillagerToolId(),
      selectionModifier: draft.modifier,
      cellKeys: draft.cellKeys,
      inputShape: shape,
      currentMarkers: this.taskMarkersByCell,
      nowMs: performance.now()
    });
    this.taskMarkersByCell = rectOutcome.nextMarkers;
    syncTaskMarkerView(
      this.taskMarkerGraphics, this.taskMarkerTexts, this,
      this.taskMarkersByCell, this.worldGrid, this.gridOriginX, this.gridOriginY
    );
    if (rectOutcome.resultSummaryLine !== null) {
      this.hud.syncPlayerChannelLastResult(rectOutcome.resultSummaryLine);
    }
    // 框选只为采集本轮格集合并提交意图；提交后清空 persisted selection，避免松手仍留高亮（与网关接受/拒绝无关）。
    this.floorSelectionState = clearFloorSelection(this.floorSelectionState);
    this.redrawSelectionAndBrush();
  }

  private redrawSelectionAndBrush(): void {
    redrawFloorSelection(
      this.floorSelectionGraphics, this.floorSelectionDraftGraphics,
      this.floorSelectionState, this.worldGrid, this.gridOriginX, this.gridOriginY
    );
    if (this.brushState.active) {
      drawSelectionOverlay(
        this.floorSelectionDraftGraphics,
        this.brushState.accumulatedKeys,
        this.worldGrid,
        this.gridOriginX,
        this.gridOriginY,
        0xf4a261,
        0.24,
        0xffd6a8,
        0.92
      );
    }
  }

  private syncPlayerChannelUi(): void {
    const tool = VILLAGER_TOOLS[this.selectedToolIndex]!;
    const { modeLine } = presentationForVillagerTool(tool);
    const scen = playerAcceptanceScenarioById(this.acceptanceScenarioId);
    const tag = scen && scen.id !== "off" ? ` · 验收：${scen.title}` : "";
    const foot = `世界快照：${this.worldPort.lineA.snapshotLabel}${tag}`;
    this.hud.syncPlayerChannelHint(modeLine, foot);
  }

  private applyAcceptanceScenario(scenarioId: string): void {
    const scenario =
      playerAcceptanceScenarioById(scenarioId) ??
      playerAcceptanceScenarioById(DEFAULT_PLAYER_ACCEPTANCE_SCENARIO_ID)!;
    this.acceptanceScenarioId = scenario.id;
    this.worldPort.resetSession();
    this.worldPort.applyMockConfig(scenarioToMockWorldPortConfig(scenario));

    if (scenario.resetMarkersOnEnter) {
      this.taskMarkersByCell = new Map();
      syncTaskMarkerView(
        this.taskMarkerGraphics,
        this.taskMarkerTexts,
        this,
        this.taskMarkersByCell,
        this.worldGrid,
        this.gridOriginX,
        this.gridOriginY
      );
      this.floorSelectionState = createFloorSelectionState();
      this.brushState = inactiveBrushStroke();
      this.activeSelectionPointerId = undefined;
      this.redrawSelectionAndBrush();
      this.hud.syncPlayerChannelLastResult(null);
    }

    this.hud.syncBAcceptancePanel(scenario);
    this.syncPlayerChannelUi();
  }

  private runAcceptanceReplay(): void {
    if (this.worldPort.getCommandLog().length === 0) {
      this.hud.syncPlayerChannelLastResult("回放：暂无已记录的命令");
      return;
    }
    const results = this.worldPort.replayAll(performance.now());
    this.taskMarkersByCell = this.worldPort.mergeTaskMarkerOverlayWithWorld(
      rebuildTaskMarkersFromCommandResults(this.worldPort.getCommandLog(), results)
    );
    syncTaskMarkerView(
      this.taskMarkerGraphics,
      this.taskMarkerTexts,
      this,
      this.taskMarkersByCell,
      this.worldGrid,
      this.gridOriginX,
      this.gridOriginY
    );
    const n = results.length;
    const ok = results.filter((r) => r.accepted).length;
    this.hud.syncPlayerChannelLastResult(`回放完成：${n} 条，接受 ${ok}/${n}`);
  }

  private setupInteractionCancelKey(): void {
    if (!this.input.keyboard) return;
    this.teardownInteractionCancelKey();
    const key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    key.on("down", this.cancelInteractionGesture, this);
    this.escKeyObject = key;
  }

  private teardownInteractionCancelKey(): void {
    this.escKeyObject?.destroy();
    this.escKeyObject = null;
  }

  private cancelInteractionGesture(): void {
    this.brushState = inactiveBrushStroke();
    this.floorSelectionState = clearFloorSelection(this.floorSelectionState);
    this.activeSelectionPointerId = undefined;
    this.redrawSelectionAndBrush();
  }

  // ── Pointer helpers ───────────────────────────────────────

  private pointerCell(pointer: Phaser.Input.Pointer, clampToGrid = false): GridCoord | undefined {
    const cam = this.cameras.main;
    const w = cam.getWorldPoint(pointer.x, pointer.y);
    const direct = cellAtWorldPixel(this.worldGrid, this.gridOriginX, this.gridOriginY, w.x, w.y);
    if (direct || !clampToGrid) return direct ?? undefined;

    const col = Phaser.Math.Clamp(
      Math.floor((w.x - this.gridOriginX) / this.worldGrid.cellSizePx),
      0,
      this.worldGrid.columns - 1
    );
    const row = Phaser.Math.Clamp(
      Math.floor((w.y - this.gridOriginY) / this.worldGrid.cellSizePx),
      0,
      this.worldGrid.rows - 1
    );
    return { col, row };
  }

  private pointerHasShift(pointer: Phaser.Input.Pointer): boolean {
    const event = pointer.event as MouseEvent | PointerEvent | undefined;
    return event?.shiftKey ?? false;
  }

  private pointerHasCtrl(pointer: Phaser.Input.Pointer): boolean {
    const event = pointer.event as MouseEvent | PointerEvent | undefined;
    return event?.ctrlKey ?? false;
  }

  // ── Shutdown ──────────────────────────────────────────────

  private onShutdown(): void {
    this.teardownTimeControls();
    this.teardownVillagerToolBarKeys();
    this.teardownInteractionCancelKey();
    this.hud.teardownAll();
    // scene.restart 会先销毁本场景子对象；若不释放 Map 引用，create() 仍会复用已销毁的 Text 等并触发崩溃
    this.interactionLabels.clear();
    this.taskMarkerTexts.clear();
    this.views.clear();
  }
}

// ── Pure helper ───────────────────────────────────────────────

function sameTimeOfDayPalette(left: TimeOfDayPalette, right: TimeOfDayPalette): boolean {
  return (
    left.backgroundColor === right.backgroundColor &&
    left.gridLineColor === right.gridLineColor &&
    left.gridBorderColor === right.gridBorderColor &&
    left.primaryTextColor === right.primaryTextColor &&
    left.secondaryTextColor === right.secondaryTextColor
  );
}
