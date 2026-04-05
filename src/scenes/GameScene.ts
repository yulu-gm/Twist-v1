import Phaser from "phaser";
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
  cellCenterWorld,
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

  public constructor() {
    super("game");
  }

  public init(data: { variant?: string }): void {
    const v = data.variant;
    this.variant = v === "alt-en" ? "alt-en" : "default";
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#171411");
    this.layoutGrid();

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
}
