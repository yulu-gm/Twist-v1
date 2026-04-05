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
  canChooseNewGoal,
  chooseGoalDecision,
  chooseStepTowardCell,
  chooseWanderStep,
  targetCellForDecision
} from "../game/goal-driven-planning";
import {
  advanceNeeds,
  advancePawnActionTimer,
  advanceMoveTowardTarget,
  applyNeedDelta,
  beginMove,
  clearPawnIntent,
  createDefaultPawnStates,
  DEFAULT_PAWN_NAMES,
  finishMoveIfComplete,
  isMoving,
  logicalCellsByPawnId,
  pickRandomAltPawnNames,
  pawnDisplayWorldCenter,
  resetPawnActionTimer,
  setPawnIntent,
  type PawnState
} from "../game/pawn-state";
import {
  blockedKeysFromCells,
  cellAtWorldPixel,
  cellCenterWorld,
  coordKey,
  createReservationSnapshot,
  DEFAULT_WORLD_GRID,
  findInteractionPointById,
  pickRandomBlockedCells,
  releaseInteractionPoint,
  reserveInteractionPoint,
  type GridCoord,
  type ReservationSnapshot,
  type WorldGridConfig
} from "../game/world-grid";
import { formatMockGridCellHoverText } from "./mock-grid-cell-info";
import { mockIssuedTaskLabelForVillagerToolId } from "./mock-task-marker-commands";
import { MOCK_SCATTERED_GROUND_ITEMS } from "./mock-ground-items";
import {
  MOCK_VILLAGER_TOOLS,
  MOCK_VILLAGER_TOOL_KEY_CODES
} from "./mock-villager-tools";
import { mockPawnProfileForId } from "./mock-pawn-profile-data";

const MOVE_DURATION_SEC = 0.42;
/** 开局随机散落的石头格数量（不与默认出生点重叠）。 */
const STONE_CELL_COUNT = 14;
const NEED_GROWTH_PER_SEC = {
  hunger: 2.6,
  rest: 1.9,
  recreation: 1.4
} as const;

type PawnView = Readonly<{
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}>;

export type GameSceneVariant = "default" | "alt-en";

export class GameScene extends Phaser.Scene {
  private gridOriginX = 0;
  private gridOriginY = 0;
  private worldGrid: WorldGridConfig = DEFAULT_WORLD_GRID;
  private pawns: PawnState[] = [];
  private views = new Map<string, PawnView>();
  private variant: GameSceneVariant = "default";
  private reservations: ReservationSnapshot = createReservationSnapshot();
  private interactionGraphics!: Phaser.GameObjects.Graphics;
  private interactionLabels = new Map<string, Phaser.GameObjects.Text>();
  private hoverHighlightFrame!: Phaser.GameObjects.Rectangle;
  private lastHoverKey: string | null = "\0";
  private hoverHudEl: HTMLElement | null = null;
  private selectedToolIndex = 0;
  private toolSlotEls: HTMLElement[] = [];
  private toolKeyObjects: Phaser.Input.Keyboard.Key[] = [];
  private toolUiAbort: AbortController | null = null;
  private pawnRosterAbort: AbortController | null = null;
  private pawnRosterSlotEls: HTMLElement[] = [];
  private selectedPawnId: string | null = null;
  private pawnDetailEl: HTMLElement | null = null;
  /** 各格上的 mock 任务标记文案（键为 `coordKey`）。 */
  private taskMarkersByCell = new Map<string, string>();
  private taskMarkerGraphics!: Phaser.GameObjects.Graphics;
  private taskMarkerTexts = new Map<string, Phaser.GameObjects.Text>();
  private floorSelectionGraphics!: Phaser.GameObjects.Graphics;
  private floorSelectionDraftGraphics!: Phaser.GameObjects.Graphics;
  private floorSelectionState: FloorSelectionState = createFloorSelectionState();
  private activeSelectionPointerId?: number;

  public constructor() {
    super("game");
  }

  public init(data: { variant?: string }): void {
    const v = data.variant;
    this.variant = v === "alt-en" ? "alt-en" : "default";
    this.selectedToolIndex = 0;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#171411");
    this.layoutGrid();
    this.setupGridHoverHighlight();

    const excludeSpawn = blockedKeysFromCells(DEFAULT_WORLD_GRID.defaultSpawnPoints);
    const stoneCells = pickRandomBlockedCells(
      DEFAULT_WORLD_GRID,
      STONE_CELL_COUNT,
      excludeSpawn,
      () => Math.random()
    );
    this.worldGrid = {
      ...DEFAULT_WORLD_GRID,
      blockedCellKeys: blockedKeysFromCells(stoneCells)
    };

    this.drawGridLines();
    this.drawStoneCells(stoneCells);
    this.interactionGraphics = this.add.graphics();
    this.drawInteractionPoints();
    this.drawGroundItemStacks();
    this.floorSelectionGraphics = this.add.graphics();
    this.floorSelectionDraftGraphics = this.add.graphics();
    this.floorSelectionState = createFloorSelectionState();
    this.activeSelectionPointerId = undefined;
    this.redrawFloorSelection();

    const names =
      this.variant === "alt-en"
        ? pickRandomAltPawnNames(DEFAULT_PAWN_NAMES.length)
        : [...DEFAULT_PAWN_NAMES];
    this.pawns = createDefaultPawnStates(this.worldGrid.defaultSpawnPoints, names);
    this.reservations = createReservationSnapshot();

    for (const pawn of this.pawns) {
      const pos = pawnDisplayWorldCenter(
        pawn,
        this.worldGrid,
        this.gridOriginX,
        this.gridOriginY
      );
      const cell = this.worldGrid.cellSizePx;
      const radius = Math.max(10, cell * 0.32);
      const circle = this.add.circle(pos.x, pos.y, radius, pawn.fillColor, 1);
      circle.setStrokeStyle(2, 0x1a1a1a, 0.85);
      const label = this.add
        .text(pos.x, pos.y - radius - 10, `${pawn.name}\n${pawn.debugLabel}`, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "12px",
          align: "center",
          color: "#f5f1e8"
        })
        .setOrigin(0.5, 1)
        .setLineSpacing(2);
      this.views.set(pawn.id, { circle, label });
    }

    this.bindSceneVariantSelect();
    this.hoverHudEl = document.getElementById("grid-hover-info");
    this.setupVillagerToolBar();
    this.setupPawnRosterUi();

    this.taskMarkerGraphics = this.add.graphics();
    this.taskMarkerGraphics.setDepth(35);
    this.bindGridTaskMarkerInput();
    this.syncTaskMarkerView();
    this.bindFloorSelectionInput();
  }

  public update(_time: number, delta: number): void {
    const dt = delta / 1000;
    const grid = this.worldGrid;
    let nextReservations = this.reservations;

    let nextPawns = this.pawns.map((pawn) => {
      let updated = advanceNeeds(pawn, dt, NEED_GROWTH_PER_SEC);
      updated = finishMoveIfComplete(advanceMoveTowardTarget(updated, dt, MOVE_DURATION_SEC));

      if (updated.currentAction?.kind !== "use-target") {
        return updated;
      }

      const targetId = updated.currentAction.targetId ?? updated.reservedTargetId;
      const point = targetId ? findInteractionPointById(grid, targetId) : undefined;
      if (!targetId || !point) {
        return clearPawnIntent(updated);
      }

      updated = advancePawnActionTimer(updated, dt);
      if (updated.actionTimerSec < point.useDurationSec) {
        return updated;
      }

      nextReservations = releaseInteractionPoint(nextReservations, point.id, updated.id);
      const completed = clearPawnIntent(applyNeedDelta(updated, point.needDelta));
      this.logAiEvent(updated.name, `completed ${point.kind} at ${point.id}`);
      return completed;
    });

    nextPawns = nextPawns.map((pawn) => {
      if (isMoving(pawn) || pawn.currentAction?.kind !== "move-to-target") {
        return pawn;
      }

      const targetId = pawn.currentAction.targetId ?? pawn.reservedTargetId;
      const point = targetId ? findInteractionPointById(grid, targetId) : undefined;
      if (!targetId || !point) {
        return clearPawnIntent(pawn);
      }

      if (
        pawn.logicalCell.col === point.cell.col &&
        pawn.logicalCell.row === point.cell.row
      ) {
        return setPawnIntent(
          resetPawnActionTimer(pawn),
          pawn.currentGoal,
          { kind: "use-target", targetId: point.id },
          point.id
        );
      }

      return pawn;
    });

    const plannedStepTargets = new Set<string>();
    nextPawns = nextPawns.map((pawn) => {
      if (!canChooseNewGoal(pawn)) {
        return pawn;
      }

      const logicalCells = logicalCellsByPawnId(nextPawns);
      const decision = chooseGoalDecision({
        grid,
        pawn,
        reservations: nextReservations
      });
      const previousLabel = pawn.debugLabel;

      if (decision.goal === "wander") {
        const step = chooseWanderStep(grid, pawn, logicalCells, () => Math.random());
        const wandered = setPawnIntent(
          step ? beginMove(pawn, step) : pawn,
          { kind: "wander", reason: decision.reason },
          step ? { kind: "move-to-target" } : { kind: "idle" },
          undefined
        );
        if (wandered.debugLabel !== previousLabel) {
          this.logAiEvent(wandered.name, `${wandered.debugLabel} (${decision.reason})`);
        }
        return wandered;
      }

      const targetCell = targetCellForDecision(grid, decision);
      const point = decision.targetId ? findInteractionPointById(grid, decision.targetId) : undefined;
      if (!targetCell || !point) {
        return clearPawnIntent(pawn);
      }

      const reserved = reserveInteractionPoint(nextReservations, point.id, pawn.id);
      if (!reserved) {
        this.logAiEvent(pawn.name, `reserve failed for ${point.id}`);
        return setPawnIntent(
          pawn,
          { kind: "wander", reason: "reservation-failed" },
          { kind: "idle" },
          undefined
        );
      }
      nextReservations = reserved;

      if (
        pawn.logicalCell.col === targetCell.col &&
        pawn.logicalCell.row === targetCell.row
      ) {
        const using = setPawnIntent(
          resetPawnActionTimer(pawn),
          { kind: decision.goal, reason: decision.reason, targetId: point.id },
          { kind: "use-target", targetId: point.id },
          point.id
        );
        if (using.debugLabel !== previousLabel) {
          this.logAiEvent(using.name, `${using.debugLabel} (${decision.reason})`);
        }
        return using;
      }

      const step = chooseStepTowardCell(grid, pawn, logicalCells, targetCell);
      if (!step) {
        nextReservations = releaseInteractionPoint(nextReservations, point.id, pawn.id);
        this.logAiEvent(pawn.name, `wait: no step toward ${point.id}`);
        return setPawnIntent(
          pawn,
          { kind: decision.goal, reason: "step-blocked", targetId: point.id },
          { kind: "idle", targetId: point.id },
          undefined
        );
      }

      const stepKey = `${step.col},${step.row}`;
      if (plannedStepTargets.has(stepKey)) {
        nextReservations = releaseInteractionPoint(nextReservations, point.id, pawn.id);
        return setPawnIntent(
          pawn,
          { kind: decision.goal, reason: "step-conflict", targetId: point.id },
          { kind: "idle", targetId: point.id },
          undefined
        );
      }

      plannedStepTargets.add(stepKey);
      const moving = setPawnIntent(
        beginMove(pawn, step),
        { kind: decision.goal, reason: decision.reason, targetId: point.id },
        { kind: "move-to-target", targetId: point.id },
        point.id
      );
      if (moving.debugLabel !== previousLabel) {
        this.logAiEvent(moving.name, `${moving.debugLabel} (${decision.reason})`);
      }
      return moving;
    });

    this.reservations = nextReservations;
    this.pawns = nextPawns;
    this.drawInteractionPoints();

    for (const pawn of this.pawns) {
      const view = this.views.get(pawn.id);
      if (!view) continue;

      const pos = pawnDisplayWorldCenter(pawn, grid, this.gridOriginX, this.gridOriginY);
      view.circle.setPosition(pos.x, pos.y);
      const radius = view.circle.radius;
      view.label.setPosition(pos.x, pos.y - radius - 10);
      view.label.setText(`${pawn.name}\n${pawn.debugLabel}`);
    }

    this.syncHoverFromPointer();
    this.syncPawnDetailPanel();
  }

  private layoutGrid(): void {
    const { width, height } = this.scale;
    const { columns, rows, cellSizePx } = DEFAULT_WORLD_GRID;
    const gridW = columns * cellSizePx;
    const gridH = rows * cellSizePx;
    this.gridOriginX = (width - gridW) / 2;
    this.gridOriginY = (height - gridH) / 2;
  }

  private drawStoneCells(cells: readonly GridCoord[]): void {
    const cellPx = this.worldGrid.cellSizePx;
    const side = Math.max(14, cellPx * 0.42);
    for (const cell of cells) {
      const pos = cellCenterWorld(this.worldGrid, cell, this.gridOriginX, this.gridOriginY);
      const stone = this.add.rectangle(pos.x, pos.y, side, side * 0.88, 0x6b6560, 1);
      stone.setStrokeStyle(1, 0x3d3830, 0.92);
    }
  }

  private drawGridLines(): void {
    const g = this.add.graphics();
    const { columns, rows, cellSizePx } = DEFAULT_WORLD_GRID;
    const ox = this.gridOriginX;
    const oy = this.gridOriginY;
    const gridW = columns * cellSizePx;
    const gridH = rows * cellSizePx;

    g.lineStyle(1, 0x3d3830, 0.9);
    for (let c = 0; c <= columns; c++) {
      const x = ox + c * cellSizePx;
      g.lineBetween(x, oy, x, oy + gridH);
    }
    for (let r = 0; r <= rows; r++) {
      const y = oy + r * cellSizePx;
      g.lineBetween(ox, y, ox + gridW, y);
    }
    g.lineStyle(2, 0x5c5346, 0.55);
    g.strokeRect(ox + 1, oy + 1, gridW - 2, gridH - 2);
  }

  private setupGridHoverHighlight(): void {
    const cs = DEFAULT_WORLD_GRID.cellSizePx;
    const frame = this.add.rectangle(0, 0, cs - 2, cs - 2, 0x000000, 0);
    frame.setStrokeStyle(2, 0xe8c547, 1);
    frame.setDepth(80);
    frame.setVisible(false);
    this.hoverHighlightFrame = frame;
  }

  private pointerToCell(pointer: Phaser.Input.Pointer): GridCoord | null {
    const cam = this.cameras.main;
    const w = cam.getWorldPoint(pointer.x, pointer.y);
    return cellAtWorldPixel(this.worldGrid, this.gridOriginX, this.gridOriginY, w.x, w.y);
  }

  /**
   * 左键点格：当前工具若视为下达指令则在该格显示任务标记；待机工具则清除该格标记。
   * 数据为 mock，见 `mock-task-marker-commands`。
   */
  private bindGridTaskMarkerInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      if (this.shouldUseFloorSelection(pointer)) return;
      const cell = this.pointerToCell(pointer);
      if (!cell) return;

      const tool = MOCK_VILLAGER_TOOLS[this.selectedToolIndex];
      const issuedLabel = mockIssuedTaskLabelForVillagerToolId(tool.id);
      const key = coordKey(cell);
      if (issuedLabel === null) {
        this.taskMarkersByCell.delete(key);
      } else {
        this.taskMarkersByCell.set(key, issuedLabel);
      }
      this.syncTaskMarkerView();
    });
  }

  private parseCoordKey(key: string): GridCoord | null {
    const comma = key.indexOf(",");
    if (comma <= 0) return null;
    const col = Number(key.slice(0, comma));
    const row = Number(key.slice(comma + 1));
    if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
    return { col, row };
  }

  /** 半格直径的圆线框 + 任务名于格心（临时表现）。 */
  private syncTaskMarkerView(): void {
    const g = this.taskMarkerGraphics;
    g.clear();
    const cs = this.worldGrid.cellSizePx;
    const radius = cs * 0.25;

    for (const [key, text] of [...this.taskMarkerTexts]) {
      if (!this.taskMarkersByCell.has(key)) {
        text.destroy();
        this.taskMarkerTexts.delete(key);
      }
    }

    g.lineStyle(2, 0xd4a84b, 0.92);

    for (const [key, taskName] of this.taskMarkersByCell) {
      const cell = this.parseCoordKey(key);
      if (!cell) continue;
      const cx = this.gridOriginX + cell.col * cs + cs / 2;
      const cy = this.gridOriginY + cell.row * cs + cs / 2;

      g.strokeCircle(cx, cy, radius);

      let text = this.taskMarkerTexts.get(key);
      if (!text) {
        text = this.add
          .text(cx, cy, taskName, {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: "10px",
            color: "#f0e6d2",
            align: "center",
            stroke: "#000000",
            strokeThickness: 3
          })
          .setOrigin(0.5, 0.5)
          .setDepth(36);
        this.taskMarkerTexts.set(key, text);
      } else {
        text.setText(taskName);
        text.setPosition(cx, cy);
      }
    }
  }

  private syncHoverFromPointer(): void {
    const ptr = this.input.activePointer;
    const cell = this.pointerToCell(ptr);
    const key = cell ? coordKey(cell) : null;
    if (key === this.lastHoverKey) return;
    this.lastHoverKey = key;

    if (!cell) {
      this.hoverHighlightFrame.setVisible(false);
      const el = this.hoverHudEl;
      if (el) el.hidden = true;
      return;
    }

    const cs = this.worldGrid.cellSizePx;
    const cx = this.gridOriginX + cell.col * cs + cs / 2;
    const cy = this.gridOriginY + cell.row * cs + cs / 2;
    this.hoverHighlightFrame.setPosition(cx, cy);
    this.hoverHighlightFrame.setSize(cs - 2, cs - 2);
    this.hoverHighlightFrame.setVisible(true);

    const el = this.hoverHudEl;
    if (el) {
      el.hidden = false;
      el.textContent = formatMockGridCellHoverText(cell, this.worldGrid);
    }
  }

  /** 临时掉落物：线框 + 名称 + 右下角数量（数据见 `mock-ground-items`）。 */
  private drawGroundItemStacks(): void {
    const g = this.add.graphics();
    g.setDepth(25);
    const cs = this.worldGrid.cellSizePx;
    const pad = 4;
    const ox = this.gridOriginX;
    const oy = this.gridOriginY;

    for (const stack of MOCK_SCATTERED_GROUND_ITEMS) {
      const { col, row } = stack.cell;
      const left = ox + col * cs + pad;
      const top = oy + row * cs + pad;
      const w = cs - pad * 2;
      const h = cs - pad * 2;

      g.lineStyle(2, 0xc9b87a, 0.95);
      g.strokeRect(left, top, w, h);

      const cx = ox + (col + 0.5) * cs;
      const cy = oy + (row + 0.5) * cs;
      this.add
        .text(cx, cy, stack.displayName, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "11px",
          color: "#e8dcc8",
          align: "center"
        })
        .setOrigin(0.5, 0.5)
        .setDepth(25);

      const rx = ox + (col + 1) * cs - pad;
      const ry = oy + (row + 1) * cs - pad;
      this.add
        .text(rx, ry, String(stack.quantity), {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "10px",
          color: "#f0e6d2"
        })
        .setOrigin(1, 1)
        .setDepth(25);
    }
  }

  private drawInteractionPoints(): void {
    this.interactionGraphics.clear();

    for (const point of this.worldGrid.interactionPoints) {
      const pos = cellCenterWorld(
        this.worldGrid,
        point.cell,
        this.gridOriginX,
        this.gridOriginY
      );
      const reserved = this.reservations.has(point.id);
      const color =
        point.kind === "food"
          ? 0xc57b57
          : point.kind === "bed"
            ? 0x5d7fa3
            : 0x5ea37c;

      this.interactionGraphics.fillStyle(color, reserved ? 0.95 : 0.65);
      this.interactionGraphics.lineStyle(2, reserved ? 0xf5f1e8 : 0x1f1a16, 0.85);

      if (point.kind === "bed") {
        this.interactionGraphics.fillRect(pos.x - 14, pos.y - 10, 28, 20);
        this.interactionGraphics.strokeRect(pos.x - 14, pos.y - 10, 28, 20);
      } else if (point.kind === "food") {
        this.interactionGraphics.fillCircle(pos.x, pos.y, 12);
        this.interactionGraphics.strokeCircle(pos.x, pos.y, 12);
      } else {
        this.interactionGraphics.beginPath();
        this.interactionGraphics.moveTo(pos.x, pos.y - 12);
        this.interactionGraphics.lineTo(pos.x + 12, pos.y);
        this.interactionGraphics.lineTo(pos.x, pos.y + 12);
        this.interactionGraphics.lineTo(pos.x - 12, pos.y);
        this.interactionGraphics.closePath();
        this.interactionGraphics.fillPath();
        this.interactionGraphics.strokePath();
      }

      let label = this.interactionLabels.get(point.id);
      if (!label) {
        label = this.add
          .text(pos.x, pos.y + 18, point.kind.toUpperCase(), {
            fontFamily: "Segoe UI, sans-serif",
            fontSize: "10px",
            color: "#eadfcb"
          })
          .setOrigin(0.5, 0);
        this.interactionLabels.set(point.id, label);
      }
      label.setPosition(pos.x, pos.y + 18);
      label.setAlpha(reserved ? 1 : 0.8);
    }
  }

  private logAiEvent(pawnName: string, message: string): void {
    console.info(`[AI] ${pawnName}: ${message}`);
  }

  private bindSceneVariantSelect(): void {
    const sel = document.getElementById("scene-variant") as HTMLSelectElement | null;
    if (!sel) return;
    sel.value = this.variant;
    sel.onchange = () => {
      const next = sel.value === "alt-en" ? "alt-en" : "default";
      this.scene.restart({ variant: next });
    };
  }

  private setupVillagerToolBar(): void {
    this.teardownVillagerToolBar();
    const root = document.getElementById("villager-tool-bar");
    if (!root || !this.input.keyboard) return;

    this.toolUiAbort = new AbortController();
    const { signal } = this.toolUiAbort;

    for (let i = 0; i < MOCK_VILLAGER_TOOLS.length; i++) {
      const tool = MOCK_VILLAGER_TOOLS[i];
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "tool-slot";
      slot.dataset.toolId = tool.id;
      slot.title = `${tool.hint}（${tool.hotkey}）`;
      slot.setAttribute("aria-label", `${tool.label}，快捷键 ${tool.hotkey}`);
      slot.innerHTML = `<span class="tool-key">${tool.hotkey}</span><div class="tool-label">${tool.label}</div>`;
      slot.addEventListener(
        "click",
        () => {
          this.selectVillagerTool(i);
        },
        { signal }
      );
      root.appendChild(slot);
      this.toolSlotEls.push(slot);
    }

    for (let i = 0; i < MOCK_VILLAGER_TOOL_KEY_CODES.length; i++) {
      const code = MOCK_VILLAGER_TOOL_KEY_CODES[i];
      const key = this.input.keyboard.addKey(code);
      this.toolKeyObjects.push(key);
      key.on("down", () => {
        this.selectVillagerTool(i);
      });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardownVillagerToolBar, this);
    this.selectVillagerTool(this.selectedToolIndex);
  }

  private selectVillagerTool(index: number): void {
    if (index < 0 || index >= MOCK_VILLAGER_TOOLS.length) return;
    this.selectedToolIndex = index;
    for (let i = 0; i < this.toolSlotEls.length; i++) {
      const el = this.toolSlotEls[i];
      const on = i === index;
      el.classList.toggle("selected", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  private teardownVillagerToolBar(): void {
    this.toolUiAbort?.abort();
    this.toolUiAbort = null;
    for (const k of this.toolKeyObjects) {
      k.destroy();
    }
    this.toolKeyObjects = [];
    this.toolSlotEls = [];
    const toolRoot = document.getElementById("villager-tool-bar");
    if (toolRoot) toolRoot.replaceChildren();
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.teardownVillagerToolBar, this);
  }

  private setupPawnRosterUi(): void {
    this.teardownPawnRosterUi();
    const rosterRoot = document.getElementById("pawn-roster");
    this.pawnDetailEl = document.getElementById("pawn-detail-panel");
    if (!rosterRoot || !this.pawnDetailEl) return;

    this.pawnRosterAbort = new AbortController();
    const { signal } = this.pawnRosterAbort;

    for (const pawn of this.pawns) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "pawn-roster-item";
      slot.dataset.pawnId = pawn.id;
      slot.role = "tab";
      slot.title = `查看 ${pawn.name}`;
      slot.setAttribute("aria-label", `${pawn.name}，打开人物信息`);

      const thumb = document.createElement("span");
      thumb.className = "pawn-roster-thumb";
      thumb.style.backgroundColor = this.phaserFillColorToCss(pawn.fillColor);
      thumb.setAttribute("aria-hidden", "true");

      const nameEl = document.createElement("span");
      nameEl.className = "pawn-roster-name";
      nameEl.textContent = pawn.name;

      slot.append(thumb, nameEl);
      slot.addEventListener(
        "click",
        () => {
          this.selectPawnForRoster(pawn.id);
        },
        { signal }
      );
      rosterRoot.appendChild(slot);
      this.pawnRosterSlotEls.push(slot);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardownPawnRosterUi, this);
    this.selectPawnForRoster(this.pawns[0]?.id ?? null);
  }

  private selectPawnForRoster(pawnId: string | null): void {
    this.selectedPawnId = pawnId;
    for (const el of this.pawnRosterSlotEls) {
      const on = el.dataset.pawnId === pawnId;
      el.classList.toggle("selected", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
    }
    this.syncPawnDetailPanel();
  }

  private syncPawnDetailPanel(): void {
    const panel = this.pawnDetailEl;
    if (!panel) return;
    const id = this.selectedPawnId;
    if (!id) {
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }
    const pawn = this.pawns.find((p) => p.id === id);
    if (!pawn) {
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }

    panel.hidden = false;
    const profile = mockPawnProfileForId(pawn.id);
    const tags = profile
      ? profile.mockTags
          .map((t) => `<span class="pawn-detail-tag">${this.escapeHtml(t)}</span>`)
          .join("")
      : "";

    const goal = pawn.currentGoal?.kind ?? "—";
    const action = pawn.currentAction?.kind ?? "—";
    const n = pawn.needs;

    panel.innerHTML = `
      <h2>${this.escapeHtml(pawn.name)}</h2>
      <p class="pawn-detail-epithet">${this.escapeHtml(profile?.epithet ?? "（无 mock 档案）")}</p>
      <div class="pawn-detail-section">
        <div class="pawn-detail-label">简介（mock）</div>
        <div>${this.escapeHtml(profile?.bio ?? "暂无。")}</div>
      </div>
      <div class="pawn-detail-section">
        <div class="pawn-detail-label">备注（mock）</div>
        <div>${this.escapeHtml(profile?.notes ?? "—")}</div>
      </div>
      <div class="pawn-detail-section">
        <div class="pawn-detail-label">当前状态</div>
        <div>饥饿 ${n.hunger.toFixed(1)}　休息 ${n.rest.toFixed(1)}　娱乐 ${n.recreation.toFixed(1)}</div>
        <div>目标 <code style="font-size:12px;color:#d4c4a8">${this.escapeHtml(String(goal))}</code>
        　行动 <code style="font-size:12px;color:#d4c4a8">${this.escapeHtml(String(action))}</code></div>
        <div style="font-size:12px;color:#a89878;margin-top:4px">${this.escapeHtml(pawn.debugLabel)}</div>
      </div>
      ${
        tags
          ? `<div class="pawn-detail-section"><div class="pawn-detail-label">标签（mock）</div><div class="pawn-detail-tags">${tags}</div></div>`
          : ""
      }
    `;
  }

  private phaserFillColorToCss(fillColor: number): string {
    const rgb = fillColor & 0xffffff;
    return `#${rgb.toString(16).padStart(6, "0")}`;
  }

  private escapeHtml(raw: string): string {
    return raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private teardownPawnRosterUi(): void {
    this.pawnRosterAbort?.abort();
    this.pawnRosterAbort = null;
    this.pawnRosterSlotEls = [];
    this.selectedPawnId = null;
    this.pawnDetailEl = null;
    const roster = document.getElementById("pawn-roster");
    if (roster) roster.replaceChildren();
    const panel = document.getElementById("pawn-detail-panel");
    if (panel) {
      panel.hidden = true;
      panel.replaceChildren();
    }
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.teardownPawnRosterUi, this);
  }

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
    if (!this.shouldUseFloorSelection(pointer)) return;

    const modifier = resolveSelectionModifier(
      this.pointerHasShift(pointer),
      this.pointerHasCtrl(pointer)
    );
    const cell = this.pointerCell(pointer);

    if (!cell) {
      this.floorSelectionState = handleOutsidePointerDown(this.floorSelectionState, modifier);
      this.activeSelectionPointerId = undefined;
      this.redrawFloorSelection();
      return;
    }

    this.floorSelectionState = beginFloorSelection(
      this.floorSelectionState,
      this.worldGrid,
      cell,
      modifier
    );
    this.activeSelectionPointerId = pointer.id;
    this.redrawFloorSelection();
  }

  private handleFloorPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.activeSelectionPointerId !== pointer.id || !pointer.isDown) return;
    if (!this.floorSelectionState.draft) return;

    const cell = this.pointerCell(pointer, true);
    if (!cell) return;

    this.floorSelectionState = updateFloorSelection(
      this.floorSelectionState,
      this.worldGrid,
      cell
    );
    this.redrawFloorSelection();
  }

  private handleFloorPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.activeSelectionPointerId !== pointer.id) return;

    const cell = this.pointerCell(pointer, true);
    if (cell && this.floorSelectionState.draft) {
      this.floorSelectionState = updateFloorSelection(
        this.floorSelectionState,
        this.worldGrid,
        cell
      );
    }

    this.floorSelectionState = commitFloorSelection(this.floorSelectionState);
    this.activeSelectionPointerId = undefined;
    this.redrawFloorSelection();
  }

  private redrawFloorSelection(): void {
    this.floorSelectionGraphics.clear();
    this.floorSelectionDraftGraphics.clear();

    this.drawSelectionOverlay(
      this.floorSelectionGraphics,
      this.floorSelectionState.selectedCellKeys,
      0x81b29a,
      0.18,
      0xb8e0d2,
      0.8
    );

    const draft = this.floorSelectionState.draft;
    if (!draft) return;

    if (draft.modifier === "toggle") {
      this.drawSelectionOverlay(
        this.floorSelectionDraftGraphics,
        draft.addedCellKeys,
        0x88c0a8,
        0.34,
        0xd8f3dc,
        0.95
      );
      this.drawSelectionOverlay(
        this.floorSelectionDraftGraphics,
        draft.removedCellKeys,
        0xc1666b,
        0.34,
        0xffd6d9,
        0.95
      );
      return;
    }

    this.drawSelectionOverlay(
      this.floorSelectionDraftGraphics,
      draft.cellKeys,
      0xd2b96c,
      0.2,
      0xf4e3b2,
      0.95
    );
  }

  private drawSelectionOverlay(
    graphics: Phaser.GameObjects.Graphics,
    cellKeys: ReadonlySet<string>,
    fillColor: number,
    fillAlpha: number,
    strokeColor: number,
    strokeAlpha: number
  ): void {
    if (cellKeys.size === 0) return;

    const cellSize = this.worldGrid.cellSizePx;

    for (let row = 0; row < this.worldGrid.rows; row++) {
      for (let col = 0; col < this.worldGrid.columns; col++) {
        const cell = { col, row };
        if (!cellKeys.has(coordKey(cell))) continue;

        const x = this.gridOriginX + col * cellSize;
        const y = this.gridOriginY + row * cellSize;
        graphics.fillStyle(fillColor, fillAlpha);
        graphics.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        graphics.lineStyle(2, strokeColor, strokeAlpha);
        graphics.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
      }
    }
  }

  private pointerCell(
    pointer: Phaser.Input.Pointer,
    clampToGrid = false
  ): GridCoord | undefined {
    const direct = this.pointerToCell(pointer);
    if (direct || !clampToGrid) return direct ?? undefined;

    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Phaser.Math.Clamp(
      Math.floor((world.x - this.gridOriginX) / this.worldGrid.cellSizePx),
      0,
      this.worldGrid.columns - 1
    );
    const row = Phaser.Math.Clamp(
      Math.floor((world.y - this.gridOriginY) / this.worldGrid.cellSizePx),
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

  private shouldUseFloorSelection(pointer: Phaser.Input.Pointer): boolean {
    return (
      this.selectedVillagerToolId() === "idle" ||
      this.pointerHasShift(pointer) ||
      this.pointerHasCtrl(pointer)
    );
  }

  private selectedVillagerToolId(): string {
    return MOCK_VILLAGER_TOOLS[this.selectedToolIndex]?.id ?? "idle";
  }
}
