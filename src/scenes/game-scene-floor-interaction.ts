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
} from "../game/interaction/floor-selection";
import type { WorldGridConfig, GridCoord } from "../game/map";
import { cellAtWorldPixel } from "../game/map";
import {
  defaultCommandMenuCommandId,
  getCommandMenuCommand,
  type CommandMenuCommandId
} from "../data/command-menu";
import {
  beginBrushStroke,
  endBrushStroke,
  extendBrushStroke,
  inactiveBrushStroke,
  type BrushStrokeState
} from "../player/brush-stroke";
import type { GameOrchestrator } from "../game/game-orchestrator";
import type { PlayerTaskMarkerOverlayPort } from "../player/world-port-types";
import type { HudManager } from "../ui/hud-manager";
import { redrawBrushStrokeDraft, redrawFloorSelection } from "./renderers/selection-renderer";
import { redrawTaskMarkers, type TaskMarkerViewDeps } from "./game-scene-presentation";

export type GameSceneFloorInteractionHost = Readonly<{
  scene: Phaser.Scene;
  getFloorSelectionGraphics: () => Phaser.GameObjects.Graphics;
  getFloorDraftGraphics: () => Phaser.GameObjects.Graphics;
  getWorldGrid: () => WorldGridConfig;
  getGridOrigin: () => { ox: number; oy: number };
  getOrchestrator: () => GameOrchestrator;
  getHud: () => HudManager;
  getTaskMarkers: () => Map<string, string>;
  setTaskMarkers: (m: Map<string, string>) => void;
  getActiveCommandId: () => CommandMenuCommandId;
  onRedrawSelection: () => void;
  getTaskMarkerView: () => TaskMarkerViewDeps;
}>;

export class GameSceneFloorInteraction {
  private floorSelectionState: FloorSelectionState = createFloorSelectionState();
  private brushState: BrushStrokeState = inactiveBrushStroke();
  private brushGestureModifier: SelectionModifier = "replace";
  private activeSelectionPointerId?: number;
  /** 本次按下解析后的命令（含无效 ID 回退默认），与 pointerup 提交一致。 */
  private gestureResolvedCommandId?: CommandMenuCommandId;

  public constructor(private readonly host: GameSceneFloorInteractionHost) {}

  public getFloorSelectionState(): FloorSelectionState {
    return this.floorSelectionState;
  }

  public resetForToolChange(): void {
    this.brushState = inactiveBrushStroke();
    this.activeSelectionPointerId = undefined;
    this.gestureResolvedCommandId = undefined;
    this.floorSelectionState = {
      selectedCellKeys: new Set(this.floorSelectionState.selectedCellKeys)
    };
    this.host.onRedrawSelection();
  }

  public resetForScenarioMarkers(): void {
    this.floorSelectionState = createFloorSelectionState();
    this.brushState = inactiveBrushStroke();
    this.activeSelectionPointerId = undefined;
    this.gestureResolvedCommandId = undefined;
    this.host.onRedrawSelection();
  }

  public cancelGesture(): void {
    this.brushState = inactiveBrushStroke();
    this.floorSelectionState = clearFloorSelection(this.floorSelectionState);
    this.activeSelectionPointerId = undefined;
    this.gestureResolvedCommandId = undefined;
    this.host.onRedrawSelection();
  }

  public redrawFloorSelectionAndBrush(): void {
    const grid = this.host.getWorldGrid();
    const { ox, oy } = this.host.getGridOrigin();
    const orchestrator = this.host.getOrchestrator();
    const port: PlayerTaskMarkerOverlayPort = orchestrator.getPlayerWorldPort();
    const activeCommand = getCommandMenuCommand(this.host.getActiveCommandId());
    const markerToolId = activeCommand?.markerToolId ?? "idle";

    let draftEligible: ReadonlySet<string> | null = null;
    const draft = this.floorSelectionState.draft;
    if (draft && markerToolId !== "idle") {
      const shape = draft.cellKeys.size === 1 ? ("single-cell" as const) : ("rect-selection" as const);
      draftEligible = port.filterTaskMarkerTargetCells(markerToolId, shape, draft.cellKeys);
    }

    redrawFloorSelection(
      this.host.getFloorSelectionGraphics(),
      this.host.getFloorDraftGraphics(),
      this.floorSelectionState,
      grid,
      ox,
      oy,
      { draftEligibleCellKeys: draftEligible }
    );
    if (this.brushState.active) {
      const brushEligible = port.filterTaskMarkerTargetCells(
        markerToolId,
        "brush-stroke",
        this.brushState.accumulatedKeys
      );
      redrawBrushStrokeDraft(
        this.host.getFloorDraftGraphics(),
        this.brushState.accumulatedKeys,
        grid,
        ox,
        oy,
        brushEligible
      );
    }
  }

  public bind(): void {
    const scene = this.host.scene;
    scene.input.off("pointerdown", this.handleFloorPointerDown, this);
    scene.input.off("pointermove", this.handleFloorPointerMove, this);
    scene.input.off("pointerup", this.handleFloorPointerUp, this);
    scene.input.on("pointerdown", this.handleFloorPointerDown, this);
    scene.input.on("pointermove", this.handleFloorPointerMove, this);
    scene.input.on("pointerup", this.handleFloorPointerUp, this);
  }

  public unbind(): void {
    const scene = this.host.scene;
    scene.input.off("pointerdown", this.handleFloorPointerDown, this);
    scene.input.off("pointermove", this.handleFloorPointerMove, this);
    scene.input.off("pointerup", this.handleFloorPointerUp, this);
  }

  private handleFloorPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.leftButtonDown()) return;
    const modifier = resolveSelectionModifier(this.pointerHasShift(pointer), this.pointerHasCtrl(pointer));
    const cell = this.pointerCell(pointer);

    if (!cell) {
      this.floorSelectionState = handleOutsidePointerDown(this.floorSelectionState, modifier);
      this.activeSelectionPointerId = undefined;
      this.brushState = inactiveBrushStroke();
      this.host.onRedrawSelection();
      return;
    }

    const commandId = this.host.getActiveCommandId();
    let command = getCommandMenuCommand(commandId);
    if (!command) {
      const fallback = getCommandMenuCommand(defaultCommandMenuCommandId());
      this.host
        .getHud()
        .syncPlayerChannelLastResult(`无效命令「${String(commandId)}」，已回退默认工具`);
      command = fallback;
    }
    if (!command) return;

    if (command.inputShape === "brush-stroke") {
      this.gestureResolvedCommandId = command.id;
      this.brushGestureModifier = modifier;
      const grid = this.host.getWorldGrid();
      this.brushState = beginBrushStroke(pointer.id, grid, cell);
      this.activeSelectionPointerId = pointer.id;
      this.host.onRedrawSelection();
      return;
    }

    if (command.inputShape === "single-cell" || command.inputShape === "rect-selection") {
      this.gestureResolvedCommandId = command.id;
      const grid = this.host.getWorldGrid();
      this.floorSelectionState = beginFloorSelection(this.floorSelectionState, grid, cell, modifier);
      this.activeSelectionPointerId = pointer.id;
      this.host.onRedrawSelection();
    }
  };

  private handleFloorPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.activeSelectionPointerId !== pointer.id || !pointer.isDown) return;
    const grid = this.host.getWorldGrid();

    if (this.brushState.active) {
      const cell = this.pointerCell(pointer, true);
      this.brushState = extendBrushStroke(grid, this.brushState, pointer.id, cell);
      this.host.onRedrawSelection();
      return;
    }

    if (!this.floorSelectionState.draft) return;
    const cell = this.pointerCell(pointer, true);
    if (!cell) return;
    this.floorSelectionState = updateFloorSelection(this.floorSelectionState, grid, cell);
    this.host.onRedrawSelection();
  };

  private handleFloorPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.activeSelectionPointerId !== pointer.id) return;
    const grid = this.host.getWorldGrid();
    const commandId =
      this.gestureResolvedCommandId ?? this.host.getActiveCommandId();

    if (this.brushState.active) {
      const keys = endBrushStroke(this.brushState);
      this.brushState = inactiveBrushStroke();
      this.activeSelectionPointerId = undefined;
      this.host.onRedrawSelection();
      if (keys.size === 0) {
        this.gestureResolvedCommandId = undefined;
        return;
      }

      this.applyCommitPlayerSelectionOutcome({
        commandId,
        selectionModifier: this.brushGestureModifier,
        cellKeys: keys,
        inputShape: "brush-stroke"
      });
      this.gestureResolvedCommandId = undefined;
      return;
    }

    const cell = this.pointerCell(pointer, true);
    if (cell && this.floorSelectionState.draft) {
      this.floorSelectionState = updateFloorSelection(this.floorSelectionState, grid, cell);
    }
    const draft = this.floorSelectionState.draft;
    this.floorSelectionState = commitFloorSelection(this.floorSelectionState);
    this.activeSelectionPointerId = undefined;
    this.host.onRedrawSelection();

    if (!draft) return;
    const shape = draft.cellKeys.size === 1 ? ("single-cell" as const) : ("rect-selection" as const);
    this.applyCommitPlayerSelectionOutcome({
      commandId,
      selectionModifier: draft.modifier,
      cellKeys: draft.cellKeys,
      inputShape: shape
    });
    this.gestureResolvedCommandId = undefined;
    this.floorSelectionState = clearFloorSelection(this.floorSelectionState);
    this.host.onRedrawSelection();
  };

  /** 单一入口：领域提交 + 标记视图刷新 + 玩家通道反馈（AP-0313 最小门面）。 */
  private applyCommitPlayerSelectionOutcome(args: Readonly<{
    commandId: CommandMenuCommandId;
    selectionModifier: SelectionModifier;
    cellKeys: ReadonlySet<string>;
    inputShape: "brush-stroke" | "single-cell" | "rect-selection";
  }>): void {
    const orchestrator = this.host.getOrchestrator();
    const hud = this.host.getHud();
    const taskMarkers = this.host.getTaskMarkers();
    const outcome = orchestrator.commitPlayerSelection({
      commandId: args.commandId,
      selectionModifier: args.selectionModifier,
      cellKeys: args.cellKeys,
      inputShape: args.inputShape,
      currentMarkers: taskMarkers,
      nowMs: performance.now()
    });
    this.host.setTaskMarkers(outcome.nextMarkers);
    redrawTaskMarkers(this.host.getTaskMarkers(), this.host.getTaskMarkerView());
    if (outcome.resultSummaryLine !== null) {
      hud.syncPlayerChannelLastResult(outcome.resultSummaryLine);
    }
  }

  private pointerCell(pointer: Phaser.Input.Pointer, clampToGrid = false): GridCoord | undefined {
    const { ox, oy } = this.host.getGridOrigin();
    const grid = this.host.getWorldGrid();
    const cam = this.host.scene.cameras.main;
    const w = cam.getWorldPoint(pointer.x, pointer.y);
    const direct = cellAtWorldPixel(grid, ox, oy, w.x, w.y);
    if (direct || !clampToGrid) return direct ?? undefined;

    const col = Phaser.Math.Clamp(
      Math.floor((w.x - ox) / grid.cellSizePx),
      0,
      grid.columns - 1
    );
    const row = Phaser.Math.Clamp(
      Math.floor((w.y - oy) / grid.cellSizePx),
      0,
      grid.rows - 1
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
}
