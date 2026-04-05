import Phaser from "phaser";
import {
  blockedKeysFromCells,
  cellCenterWorld,
  DEFAULT_WORLD_GRID,
  pickRandomBlockedCells,
  type GridCoord,
  type WorldGridConfig
} from "../game/world-grid";
import {
  advanceMoveTowardTarget,
  beginMove,
  createDefaultPawnStates,
  DEFAULT_PAWN_NAMES,
  finishMoveIfComplete,
  isMoving,
  logicalCellsByPawnId,
  pickRandomAltPawnNames,
  pawnDisplayWorldCenter,
  type PawnState
} from "../game/pawn-state";
import { legalWanderNeighbors, pickWanderTarget } from "../game/wander-planning";

const MOVE_DURATION_SEC = 0.42;
/** 开局随机散落的石头格数量（不与默认出生点重叠）。 */
const STONE_CELL_COUNT = 14;

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
    this.drawGridLines();

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
    this.drawStoneCells(stoneCells);

    const names =
      this.variant === "alt-en"
        ? pickRandomAltPawnNames(DEFAULT_PAWN_NAMES.length)
        : [...DEFAULT_PAWN_NAMES];
    this.pawns = createDefaultPawnStates(this.worldGrid.defaultSpawnPoints, names);
    for (const p of this.pawns) {
      const pos = pawnDisplayWorldCenter(
        p,
        this.worldGrid,
        this.gridOriginX,
        this.gridOriginY
      );
      const cell = this.worldGrid.cellSizePx;
      const r = Math.max(10, cell * 0.32);
      const circle = this.add.circle(pos.x, pos.y, r, p.fillColor, 1);
      circle.setStrokeStyle(2, 0x1a1a1a, 0.85);
      const label = this.add
        .text(pos.x, pos.y - r - 10, p.name, {
          fontFamily: "Segoe UI, sans-serif",
          fontSize: "13px",
          color: "#f5f1e8"
        })
        .setOrigin(0.5, 1);
      this.views.set(p.id, { circle, label });
    }

    this.bindSceneVariantSelect();
  }

  public update(_time: number, delta: number): void {
    const dt = delta / 1000;
    const grid = this.worldGrid;

    let next = this.pawns.map((p) =>
      finishMoveIfComplete(advanceMoveTowardTarget(p, dt, MOVE_DURATION_SEC))
    );
    const occ = logicalCellsByPawnId(next);
    next = next.map((p) => {
      if (isMoving(p)) return p;
      const legal = legalWanderNeighbors(grid, p, occ);
      const decision = pickWanderTarget(() => Math.random(), legal);
      if (decision.kind === "wait") return p;
      return beginMove(p, decision.target);
    });
    this.pawns = next;

    for (const p of this.pawns) {
      const view = this.views.get(p.id);
      if (!view) continue;
      const pos = pawnDisplayWorldCenter(p, grid, this.gridOriginX, this.gridOriginY);
      view.circle.setPosition(pos.x, pos.y);
      const r = view.circle.radius;
      view.label.setPosition(pos.x, pos.y - r - 10);
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
      const r = this.add.rectangle(pos.x, pos.y, side, side * 0.88, 0x6b6560, 1);
      r.setStrokeStyle(1, 0x3d3830, 0.92);
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
