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
  findInteractionPointById,
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
import { VILLAGER_TOOL_KEY_CODES } from "../data/villager-tools";
import {
  DEFAULT_COMMAND_MENU,
  TOOL_GROUPS,
  modeHintForCommandLeaf,
  type CommandMenuLeafId
} from "../ui/command-menu";
import type { UiInteractionMode } from "../ui/ui-modes";
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
  private lumberTargetGraphics!: Phaser.GameObjects.Graphics;
  private taskMarkerGraphics!: Phaser.GameObjects.Graphics;
  private taskMarkerTexts = new Map<string, Phaser.GameObjects.Text>();
  private interactionProgressGraphics!: Phaser.GameObjects.Graphics;
  private blueprintPreviewGraphics!: Phaser.GameObjects.Graphics;

  // Input / selection state
  private variant: GameSceneVariant = "default";
  private floorSelectionState: FloorSelectionState = createFloorSelectionState();
  private activeSelectionPointerId?: number;
  private selectedToolIndex = 0;
  private currentToolGroupId = "group.default";
  private selectedPawnId: string | null = null;
  private taskMarkersByCell = new Map<string, string>();
  private uiMode: UiInteractionMode = "idle";
  private treeCellKeys = new Set<string>();

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
    this.currentToolGroupId = "group.default";
    this.uiMode = "idle";
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
    this.initTreeCellKeys();

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
    this.lumberTargetGraphics = this.add.graphics();
    this.lumberTargetGraphics.setDepth(32);
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

    // UI overlay graphics
    this.interactionProgressGraphics = this.add.graphics();
    this.interactionProgressGraphics.setDepth(70);
    this.blueprintPreviewGraphics = this.add.graphics();
    this.blueprintPreviewGraphics.setDepth(75);

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
    this.hud.setModeHintColor(this.timeOfDayPalette);
    this.hud.syncTimeOfDayHud(this.timeOfDayState, this.timeControlState, this.timeOfDayPalette);
    this.setupTimeControls();
    this.setupVillagerToolBarKeys();
    this.hud.setupToolBar((i) => this.selectVillagerTool(i), this.currentToolGroupId);
    this.hud.syncToolBarSelection(this.selectedToolIndex);
    this.setupPawnRosterUi();
    this.hud.setupCommandMenu((groupId) => this.selectCommandGroup(groupId), DEFAULT_COMMAND_MENU);
    this.hud.hideModeHint();
    this.syncMenuCursor();

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
      this.syncInteractionProgressOverlays();
      this.syncPawnStatusLabels();
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
    this.syncPawnStatusLabels();
    this.syncHoverFromPointer();
    this.syncPawnDetailPanel();
    this.syncInteractionProgressOverlays();
  }

  // ── Layout ────────────────────────────────────────────────

  private initTreeCellKeys(): void {
    this.treeCellKeys.clear();
    const blocked = this.worldGrid.blockedCellKeys ?? new Set<string>();
    const spawn = blockedKeysFromCells(this.worldGrid.defaultSpawnPoints);
    const candidates: string[] = [];
    for (let row = 0; row < this.worldGrid.rows; row++) {
      for (let col = 0; col < this.worldGrid.columns; col++) {
        const key = coordKey({ col, row });
        if (blocked.has(key) || spawn.has(key)) continue;
        candidates.push(key);
      }
    }
    const want = Math.min(8, candidates.length);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = candidates[i]!;
      candidates[i] = candidates[j]!;
      candidates[j] = a;
    }
    for (let k = 0; k < want; k++) {
      this.treeCellKeys.add(candidates[k]!);
    }
  }

  private syncPawnStatusLabels(): void {
    for (const pawn of this.pawns) {
      const view = this.views.get(pawn.id);
      if (!view) continue;
      const statusLine =
        pawn.currentAction?.kind === "use-target" ? "建造中" : pawn.debugLabel;
      view.label.setText(`${pawn.name}\n${statusLine}`);
    }
  }

  private syncMenuCursor(): void {
    const canvas = this.game.canvas;
    if (!canvas) return;
    if (
      this.uiMode === "mine-mark" ||
      this.uiMode === "lumber-mark" ||
      this.uiMode === "haul-mark" ||
      this.uiMode === "storage-zone-create" ||
      this.uiMode === "blueprint-draw"
    ) {
      canvas.style.cursor = "crosshair";
    } else {
      canvas.style.cursor = "default";
    }
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
    this.hud.setModeHintColor(this.timeOfDayPalette);
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

    this.syncBlueprintPreview(cell ?? undefined);

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

  private syncBlueprintPreview(cell: GridCoord | undefined): void {
    this.blueprintPreviewGraphics.clear();
    if (this.uiMode !== "blueprint-draw") return;
    if (!cell) return;
    const blocked = this.worldGrid.blockedCellKeys?.has(coordKey(cell)) ?? false;
    const cs = this.worldGrid.cellSizePx;
    const x = this.gridOriginX + cell.col * cs;
    const y = this.gridOriginY + cell.row * cs;

    if (blocked) {
      this.blueprintPreviewGraphics.fillStyle(0xc1666b, 0.25);
      this.blueprintPreviewGraphics.fillRect(x + 2, y + 2, cs - 4, cs - 4);
      this.blueprintPreviewGraphics.lineStyle(2, 0xffd6d9, 0.95);
      this.blueprintPreviewGraphics.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
      this.blueprintPreviewGraphics.lineStyle(3, 0xff6b6b, 0.9);
      this.blueprintPreviewGraphics.beginPath();
      this.blueprintPreviewGraphics.moveTo(x + 10, y + 10);
      this.blueprintPreviewGraphics.lineTo(x + cs - 10, y + cs - 10);
      this.blueprintPreviewGraphics.moveTo(x + cs - 10, y + 10);
      this.blueprintPreviewGraphics.lineTo(x + 10, y + cs - 10);
      this.blueprintPreviewGraphics.strokePath();
      return;
    }

    this.blueprintPreviewGraphics.fillStyle(0x81b29a, 0.18);
    this.blueprintPreviewGraphics.fillRect(x + 2, y + 2, cs - 4, cs - 4);
    this.blueprintPreviewGraphics.lineStyle(2, 0xb8e0d2, 0.85);
    this.blueprintPreviewGraphics.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
  }

  private syncInteractionProgressOverlays(): void {
    this.interactionProgressGraphics.clear();
    const cs = this.worldGrid.cellSizePx;

    for (const pawn of this.pawns) {
      const action = pawn.currentAction;
      if (action?.kind !== "use-target") continue;
      const targetId = action.targetId ?? pawn.reservedTargetId;
      if (!targetId) continue;
      const point = findInteractionPointById(this.worldGrid, targetId);
      if (!point) continue;

      const progress01 = point.useDurationSec > 0
        ? Phaser.Math.Clamp(pawn.actionTimerSec / point.useDurationSec, 0, 1)
        : 0;
      const x = this.gridOriginX + point.cell.col * cs;
      const y = this.gridOriginY + point.cell.row * cs;

      const barW = cs - 10;
      const barH = 8;
      const bx = x + (cs - barW) / 2;
      const by = y - 10;

      this.interactionProgressGraphics.fillStyle(0x000000, 0.55);
      this.interactionProgressGraphics.fillRoundedRect(bx, by, barW, barH, 3);
      this.interactionProgressGraphics.fillStyle(0x81b29a, 0.9);
      this.interactionProgressGraphics.fillRoundedRect(bx, by, Math.max(2, barW * progress01), barH, 3);
      this.interactionProgressGraphics.lineStyle(1, 0xf4e3b2, 0.9);
      this.interactionProgressGraphics.strokeRoundedRect(bx, by, barW, barH, 3);
    }
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
      key.on("down", () => {
        const group = TOOL_GROUPS.find((g) => g.id === this.currentToolGroupId);
        if (group && i < group.tools.length) {
          this.selectVillagerTool(i);
        }
      });
      this.toolKeyObjects.push(key);
    }
  }

  private teardownVillagerToolBarKeys(): void {
    for (const k of this.toolKeyObjects) k.destroy();
    this.toolKeyObjects = [];
  }

  private selectVillagerTool(
    index: number
  ): void {
    const group = TOOL_GROUPS.find((g) => g.id === this.currentToolGroupId);
    if (!group) return;
    if (index < 0 || index >= group.tools.length) return;
    
    this.selectedToolIndex = index;
    this.hud.syncToolBarSelection(index);

    const toolId = group.tools[index]?.id ?? "idle";

    if (toolId === "idle") {
      this.uiMode = "idle";
      this.hud.hideModeHint();
      this.syncMenuCursor();
      return;
    }

    if (toolId === "build.wall.wood" || toolId === "build.furniture.bed") {
      this.uiMode = "blueprint-draw";
      this.hud.showModeHint(group.tools[index]?.modeHint ?? "蓝图绘制模式：选择可放置位置");
      this.syncMenuCursor();
      return;
    }

    if (toolId === "order.mine") {
      this.uiMode = "mine-mark";
      this.hud.showModeHint(group.tools[index]?.modeHint ?? "正在标记开采目标，请框选地图");
    } else if (toolId === "order.lumber") {
      this.uiMode = "lumber-mark";
      this.hud.showModeHint(group.tools[index]?.modeHint ?? "正在标记伐木目标，请框选地图");
    } else if (toolId === "order.haul") {
      this.uiMode = "haul-mark";
      this.hud.showModeHint(group.tools[index]?.modeHint ?? "正在标记可拾取物资，请框选地图");
    } else if (toolId === "zone.storage.create") {
      this.uiMode = "storage-zone-create";
      this.hud.showModeHint(group.tools[index]?.modeHint ?? "正在创建存储区，请框选地图");
    } else {
      this.uiMode = "idle";
      this.hud.hideModeHint();
    }

    this.syncMenuCursor();
  }

  private selectedVillagerToolId(): string {
    const group = TOOL_GROUPS.find((g) => g.id === this.currentToolGroupId);
    return group?.tools[this.selectedToolIndex]?.id ?? "idle";
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

  // ── Command menu / UI mode ─────────────────────────────────

  private selectCommandGroup(groupId: string): void {
    this.currentToolGroupId = groupId;
    this.hud.setupToolBar((i) => this.selectVillagerTool(i), groupId);
    
    // Select the first tool by default, or idle if present
    const group = TOOL_GROUPS.find((g) => g.id === groupId);
    if (group && group.tools.length > 0) {
      const idleIndex = group.tools.findIndex((t) => t.id === "idle");
      const indexToSelect = idleIndex >= 0 ? idleIndex : 0;
      this.selectVillagerTool(indexToSelect);
    }
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
    this.drawLumberTargetHighlights();
  }

  private drawLumberTargetHighlights(): void {
    this.lumberTargetGraphics.clear();
    if (this.selectedVillagerToolId() !== "lumber") return;
    const draft = this.floorSelectionState.draft;
    if (!draft || draft.modifier === "toggle") return;
    const cs = this.worldGrid.cellSizePx;
    for (const key of draft.cellKeys) {
      if (!this.treeCellKeys.has(key)) continue;
      const coord = parseCoordKeyForUi(key);
      if (!coord) continue;
      const x = this.gridOriginX + coord.col * cs;
      const y = this.gridOriginY + coord.row * cs;
      this.lumberTargetGraphics.lineStyle(3, 0x6abf69, 0.95);
      this.lumberTargetGraphics.strokeRect(x + 3, y + 3, cs - 6, cs - 6);
    }
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
    const canvas = this.game.canvas;
    if (canvas) canvas.style.cursor = "default";
  }
}

// ── Pure helper ───────────────────────────────────────────────

function parseCoordKeyForUi(key: string): GridCoord | null {
  const comma = key.indexOf(",");
  if (comma <= 0) return null;
  const col = Number(key.slice(0, comma));
  const row = Number(key.slice(comma + 1));
  if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
  return { col, row };
}

function sameTimeOfDayPalette(left: TimeOfDayPalette, right: TimeOfDayPalette): boolean {
  return (
    left.backgroundColor === right.backgroundColor &&
    left.gridLineColor === right.gridLineColor &&
    left.gridBorderColor === right.gridBorderColor &&
    left.primaryTextColor === right.primaryTextColor &&
    left.secondaryTextColor === right.secondaryTextColor
  );
}
