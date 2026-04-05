/**
 * pawn-renderer：Pawn 圆圈与标签的创建与位置同步。
 */

import Phaser from "phaser";
import {
  pawnDisplayWorldCenter,
  type PawnState
} from "../../game/pawn-state";
import type { WorldGridConfig } from "../../game/world-grid";
import type { TimeOfDayPalette } from "../../game/time-of-day";

export type PawnView = Readonly<{
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}>;

export function createPawnViews(
  scene: Phaser.Scene,
  pawns: readonly PawnState[],
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  palette: TimeOfDayPalette
): Map<string, PawnView> {
  const views = new Map<string, PawnView>();
  const primaryColor = `#${(palette.primaryTextColor & 0xffffff).toString(16).padStart(6, "0")}`;

  for (const pawn of pawns) {
    const pos = pawnDisplayWorldCenter(pawn, grid, ox, oy);
    const cell = grid.cellSizePx;
    const radius = Math.max(10, cell * 0.32);
    const circle = scene.add.circle(pos.x, pos.y, radius, pawn.fillColor, 1);
    circle.setStrokeStyle(2, 0x1a1a1a, 0.85);
    const label = scene.add
      .text(pos.x, pos.y - radius - 10, `${pawn.name}\n${pawn.debugLabel}`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "12px",
        align: "center",
        color: primaryColor
      })
      .setOrigin(0.5, 1)
      .setLineSpacing(2);
    views.set(pawn.id, { circle, label });
  }

  return views;
}

export function syncPawnViews(
  views: Map<string, PawnView>,
  pawns: readonly PawnState[],
  grid: WorldGridConfig,
  ox: number,
  oy: number
): void {
  for (const pawn of pawns) {
    const view = views.get(pawn.id);
    if (!view) continue;
    const pos = pawnDisplayWorldCenter(pawn, grid, ox, oy);
    view.circle.setPosition(pos.x, pos.y);
    view.label.setPosition(pos.x, pos.y - view.circle.radius - 10);
    view.label.setText(`${pawn.name}\n${pawn.debugLabel}`);
  }
}

export function applyPaletteToViews(
  views: Map<string, PawnView>,
  palette: TimeOfDayPalette
): void {
  const primaryColor = `#${(palette.primaryTextColor & 0xffffff).toString(16).padStart(6, "0")}`;
  for (const view of views.values()) {
    view.label.setColor(primaryColor);
  }
}
