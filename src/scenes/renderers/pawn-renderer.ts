/**
 * pawn-renderer：Pawn 圆圈与标签的创建与位置同步。
 */

import Phaser from "phaser";
import {
  pawnDisplayWorldCenter,
  type PawnState
} from "../../game/pawn-state";
import type { WorldGridConfig } from "../../game/map/world-grid";
import type { TimeOfDayPalette } from "../../game/time";
import { workItemAnchorDurationSeconds } from "../../game/work/work-item-duration";
import type { WorkItemSnapshot } from "../../game/work/work-types";

export type PawnView = Readonly<{
  circle: Phaser.GameObjects.Arc;
  workBarBg: Phaser.GameObjects.Rectangle;
  workBarFill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}>;

const WORK_BAR_WIDTH_PX = 36;
const WORK_BAR_HEIGHT_PX = 5;
const WORK_BAR_ABOVE_CIRCLE_TOP_PX = 4;

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
    const barY = pos.y - radius - WORK_BAR_ABOVE_CIRCLE_TOP_PX - WORK_BAR_HEIGHT_PX / 2;
    const workBarBg = scene.add.rectangle(pos.x, barY, WORK_BAR_WIDTH_PX, WORK_BAR_HEIGHT_PX, 0x6b7280);
    workBarBg.setStrokeStyle(1, 0x374151, 0.9);
    const workBarFill = scene.add.rectangle(
      pos.x - WORK_BAR_WIDTH_PX / 2,
      barY,
      0,
      WORK_BAR_HEIGHT_PX,
      0x22c55e
    );
    workBarFill.setOrigin(0, 0.5);
    workBarBg.setVisible(false);
    workBarFill.setVisible(false);
    const label = scene.add
      .text(pos.x, pos.y - radius - 10, `${pawn.name}\n${pawn.debugLabel}`, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "12px",
        align: "center",
        color: primaryColor
      })
      .setOrigin(0.5, 1)
      .setLineSpacing(2);
    views.set(pawn.id, { circle, workBarBg, workBarFill, label });
  }

  return views;
}

export function destroyPawnViews(views: Map<string, PawnView>): void {
  for (const { circle, workBarBg, workBarFill, label } of views.values()) {
    circle.destroy();
    workBarBg.destroy();
    workBarFill.destroy();
    label.destroy();
  }
  views.clear();
}

export function syncPawnViews(
  views: Map<string, PawnView>,
  pawns: readonly PawnState[],
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  workItems: ReadonlyMap<string, WorkItemSnapshot>
): void {
  for (const pawn of pawns) {
    const view = views.get(pawn.id);
    if (!view) continue;
    const pos = pawnDisplayWorldCenter(pawn, grid, ox, oy);
    const r = view.circle.radius;
    view.circle.setPosition(pos.x, pos.y);
    const barY = pos.y - r - WORK_BAR_ABOVE_CIRCLE_TOP_PX - WORK_BAR_HEIGHT_PX / 2;
    view.workBarBg.setPosition(pos.x, barY);
    view.workBarFill.setPosition(pos.x - WORK_BAR_WIDTH_PX / 2, barY);
    view.label.setPosition(pos.x, pos.y - r - 10);
    view.label.setText(`${pawn.name}\n${pawn.debugLabel}`);

    const wid = pawn.activeWorkItemId;
    const item = wid ? workItems.get(wid) : undefined;
    const totalSec =
      item !== undefined ? workItemAnchorDurationSeconds(item.kind) : undefined;
    const showWorkBar =
      pawn.workTimerSec > 0 &&
      wid !== undefined &&
      item !== undefined &&
      totalSec !== undefined &&
      totalSec > 0;
    const progress01 = showWorkBar ? pawn.workTimerSec / totalSec : 0;
    const visible = showWorkBar && progress01 < 1;
    view.workBarBg.setVisible(visible);
    view.workBarFill.setVisible(visible);
    if (visible) {
      view.workBarFill.width = WORK_BAR_WIDTH_PX * Math.min(1, Math.max(0, progress01));
    }
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
