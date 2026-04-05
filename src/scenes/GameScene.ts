import Phaser from "phaser";
import {
  beginFloorSelection,
  commitFloorSelection,
  createFloorSelectionState,
  handleOutsidePointerDown,
  resolveSelectionModifier,
  updateFloorSelection,
  type FloorSelectionState
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
  advanceTimeOfDay,
  createInitialTimeOfDayState,
  effectiveSimulationDeltaSeconds,
  sampleTimeOfDayPalette,
  type TimeControlState,
  type TimeOfDayPalette,
  type TimeSpeed,
  type TimeOfDayState
} from "../game/time-of-day";
import {
  blockedKeysFromCells,
  cellAtWorldPixel,
  coordKey,
  createReservationSnapshot,
  DEFAULT_WORLD_GRID,
  pickRandomBlockedCells,
  type GridCoord,
  type ReservationSnapshot,
  type WorldGridConfig
} from "../game/world-grid";
import { DEFAULT_SIM_CONFIG } from "../game/sim-config";
import { tickSimulation } from "../game/sim-loop";
import { formatGridCellHoverText } from "../data/grid-cell-info";
import { applyTaskMarkersForSelection } from "../data/task-markers";
import { HudManager } from "../ui/hud-manager";
import { VILLAGER_TOOLS, VILLAGER_TOOL_KEY_CODES } from "../data/villager-tools";
import { drawGridLines, drawStoneCells, drawInteractionPoints } from "./renderers/grid-renderer";
import { createPawnViews, syncPawnViews, applyPaletteToViews, type PawnView } from "./renderers/pawn-renderer";
import { drawGroundItemStacks } from "./renderers/ground-items-renderer";
import { redrawFloorSelection, syncTaskMarkerView } from "./renderers/selection-renderer";

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
  private timeControlAbort: AbortController | null = null;

  // HUD manager
  private hud!: HudManager;

  public constructor() {
    super("game");
  }

  public init(data: { variant?: string }): void {
    const v = data.variant;
    this.variant = v === "alt-en" ? "alt-en" : "default";
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

    // Build world grid with random blocked cells
    const excludeSpawn = blockedKeysFromCells(DEFAULT_WORLD_GRID.defaultSpawnPoints);
    const stoneCells = pickRandomBlockedCells(
      DEFAULT_WORLD_GRID,
      DEFAULT_SIM_CONFIG.stoneCellCount,
      excludeSpawn,
      () => Math.random()
    );
    this.worldGrid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: blockedKeysFromCells(stoneCells)
    };

    // Grid graphics
    this.gridGraphics = this.add.graphics();
    drawGridLines(this.gridGraphics, this.worldGrid, this.gridOriginX, this.gridOriginY, this.timeOfDayPalette);
    drawStoneCells(this, this.worldGrid, this.gridOriginX, this.gridOriginY, stoneCells);
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
    redrawFloorSelection(
      this.floorSelectionGraphics, this.floorSelectionDraftGraphics,
      this.floorSelectionState, this.worldGrid, this.gridOriginX, this.gridOriginY
    );

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
    this.hud.bindSceneVariantSelect(this.variant, (next) => {
      this.scene.restart({ variant: next });
    });
    this.hud.setHoverInfoColor(this.timeOfDayPalette);
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);
    this.setupTimeControls();
    this.setupVillagerToolBarKeys();
    this.hud.setupToolBar((i) => this.selectVillagerTool(i), this.selectedToolIndex);
    this.setupPawnRosterUi();

    this.bindFloorSelectionInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  public update(_time: number, delta: number): void {
    const realDt = delta / 1000;
    const simulationDt = effectiveSimulationDeltaSeconds(realDt, this.timeControlState);

    // Advance time of day
    const nextTimeState = advanceTimeOfDay(this.timeOfDayState, simulationDt, DEFAULT_TIME_OF_DAY_CONFIG);
    const nextPalette = sampleTimeOfDayPalette(nextTimeState);
    const paletteChanged = !sameTimeOfDayPalette(this.timeOfDayPalette, nextPalette);
    this.timeOfDayState = nextTimeState;
    if (paletteChanged) {
      this.timeOfDayPalette = nextPalette;
      this.applyTimeOfDayPalette();
    }
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);

    if (simulationDt <= 0) {
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
      config: DEFAULT_SIM_CONFIG,
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
      label.setColor(secondaryColor);
    }
    this.hud.setHoverInfoColor(this.timeOfDayPalette);
  }

  // ── Hover sync ────────────────────────────────────────────

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
      this.redrawSelection();
      return;
    }

    this.floorSelectionState = beginFloorSelection(this.floorSelectionState, this.worldGrid, cell, modifier);
    this.activeSelectionPointerId = pointer.id;
    this.redrawSelection();
  }

  private handleFloorPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.activeSelectionPointerId !== pointer.id || !pointer.isDown) return;
    if (!this.floorSelectionState.draft) return;
    const cell = this.pointerCell(pointer, true);
    if (!cell) return;
    this.floorSelectionState = updateFloorSelection(this.floorSelectionState, this.worldGrid, cell);
    this.redrawSelection();
  }

  private handleFloorPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.activeSelectionPointerId !== pointer.id) return;
    const cell = this.pointerCell(pointer, true);
    if (cell && this.floorSelectionState.draft) {
      this.floorSelectionState = updateFloorSelection(this.floorSelectionState, this.worldGrid, cell);
    }
    const draft = this.floorSelectionState.draft;
    this.floorSelectionState = commitFloorSelection(this.floorSelectionState);
    this.activeSelectionPointerId = undefined;
    this.redrawSelection();

    if (!draft) return;
    this.taskMarkersByCell = applyTaskMarkersForSelection(this.taskMarkersByCell, {
      toolId: this.selectedVillagerToolId(),
      modifier: draft.modifier,
      cellKeys: draft.cellKeys
    });
    syncTaskMarkerView(
      this.taskMarkerGraphics, this.taskMarkerTexts, this,
      this.taskMarkersByCell, this.worldGrid, this.gridOriginX, this.gridOriginY
    );
  }

  private redrawSelection(): void {
    redrawFloorSelection(
      this.floorSelectionGraphics, this.floorSelectionDraftGraphics,
      this.floorSelectionState, this.worldGrid, this.gridOriginX, this.gridOriginY
    );
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
    this.hud.teardownAll();
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
