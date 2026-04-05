import type Phaser from "phaser";
import { formatGridCellHoverText } from "../data/grid-cell-info";
import { taskMarkerMapsEqual } from "../data/task-markers";
import { cellAtWorldPixel, coordKey, type WorldGridConfig } from "../game/map";
import type { TimeOfDayPalette } from "../game/time";
import type { GameOrchestrator } from "../game/game-orchestrator";
import type { HudManager } from "../ui/hud-manager";
import { drawGridLines } from "./renderers/grid-renderer";
import { applyPaletteToViews, type PawnView } from "./renderers/pawn-renderer";
import { syncTaskMarkerView } from "./renderers/selection-renderer";

export type TimeOfDayPalettePresentationDeps = Readonly<{
  gridGraphics: Phaser.GameObjects.Graphics;
  views: Map<string, PawnView>;
  interactionLabels: Map<string, Phaser.GameObjects.Text>;
  camera: Phaser.Cameras.Scene2D.Camera;
  hud: HudManager;
  worldGrid: WorldGridConfig;
  gridOriginX: number;
  gridOriginY: number;
  timeOfDayPalette: TimeOfDayPalette;
}>;

export function applyTimeOfDayPaletteToScene(deps: TimeOfDayPalettePresentationDeps): void {
  const {
    gridGraphics,
    views,
    interactionLabels,
    camera,
    hud,
    worldGrid,
    gridOriginX,
    gridOriginY,
    timeOfDayPalette
  } = deps;
  camera.setBackgroundColor(timeOfDayPalette.backgroundColor);
  drawGridLines(gridGraphics, worldGrid, gridOriginX, gridOriginY, timeOfDayPalette);
  applyPaletteToViews(views, timeOfDayPalette);
  const secondaryColor = `#${(timeOfDayPalette.secondaryTextColor & 0xffffff).toString(16).padStart(6, "0")}`;
  for (const label of interactionLabels.values()) {
    if (label.active) label.setColor(secondaryColor);
  }
  hud.setHoverInfoColor(timeOfDayPalette);
}

export type HoverSyncDeps = Readonly<{
  camera: Phaser.Cameras.Scene2D.Camera;
  activePointer: Phaser.Input.Pointer;
  worldGrid: WorldGridConfig;
  gridOriginX: number;
  gridOriginY: number;
  hoverHighlightFrame: Phaser.GameObjects.Rectangle;
  hud: HudManager;
  lastHoverKeyRef: { current: string | null };
}>;

export function syncHoverFromPointerState(deps: HoverSyncDeps): void {
  const { camera, activePointer, worldGrid, gridOriginX, gridOriginY, hoverHighlightFrame, hud, lastHoverKeyRef } =
    deps;
  const w = camera.getWorldPoint(activePointer.x, activePointer.y);
  const cell = cellAtWorldPixel(worldGrid, gridOriginX, gridOriginY, w.x, w.y);
  const key = cell ? coordKey(cell) : null;
  if (key === lastHoverKeyRef.current) return;
  lastHoverKeyRef.current = key;

  if (!cell) {
    hoverHighlightFrame.setVisible(false);
    hud.hideHoverInfo();
    return;
  }

  const cs = worldGrid.cellSizePx;
  const cx = gridOriginX + cell.col * cs + cs / 2;
  const cy = gridOriginY + cell.row * cs + cs / 2;
  hoverHighlightFrame.setPosition(cx, cy);
  hoverHighlightFrame.setSize(cs - 2, cs - 2);
  hoverHighlightFrame.setVisible(true);
  hud.showHoverInfo(formatGridCellHoverText(cell, worldGrid));
}

export function mergeMarkerOverlayIfChanged(
  orchestrator: GameOrchestrator,
  taskMarkersByCell: Map<string, string>
): Map<string, string> | null {
  const merged = orchestrator.mergeTaskMarkerOverlayWithWorld(taskMarkersByCell);
  if (taskMarkerMapsEqual(merged, taskMarkersByCell)) return null;
  return merged;
}

export type TaskMarkerViewDeps = Readonly<{
  taskMarkerGraphics: Phaser.GameObjects.Graphics;
  taskMarkerTexts: Map<string, Phaser.GameObjects.Text>;
  scene: Phaser.Scene;
  worldGrid: WorldGridConfig;
  gridOriginX: number;
  gridOriginY: number;
}>;

export function redrawTaskMarkers(
  markers: Map<string, string>,
  viewDeps: TaskMarkerViewDeps
): void {
  syncTaskMarkerView(
    viewDeps.taskMarkerGraphics,
    viewDeps.taskMarkerTexts,
    viewDeps.scene,
    markers,
    viewDeps.worldGrid,
    viewDeps.gridOriginX,
    viewDeps.gridOriginY
  );
}
