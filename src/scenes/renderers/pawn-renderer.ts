/**
 * pawn-renderer：Pawn 圆圈与标签的创建与位置同步。
 */

import Phaser from "phaser";
import {
  formatPawnMapHudBody,
  pawnDisplayWorldCenter,
  type PawnState
} from "../../game/pawn-state";
import type { SimConfig } from "../../game/behavior/sim-config";
import { cellCenterWorld, type WorldGridConfig } from "../../game/map";
import type { TimeOfDayPalette } from "../../ui/time-of-day-palette";
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
/** 读条相对锚点（小人圆顶或工单锚格顶边）向上的间距。 */
const WORK_BAR_ABOVE_ANCHOR_PX = 4;

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
    const barY = pos.y - radius - WORK_BAR_ABOVE_ANCHOR_PX - WORK_BAR_HEIGHT_PX / 2;
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
      .text(pos.x, pos.y - radius - 10, `${pawn.name}\n${formatPawnMapHudBody(pawn)}`, {
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
  workItems: ReadonlyMap<string, WorkItemSnapshot>,
  workItemAnchorDurationSec: SimConfig["workItemAnchorDurationSec"]
): void {
  for (const pawn of pawns) {
    const view = views.get(pawn.id);
    if (!view) continue;
    const pos = pawnDisplayWorldCenter(pawn, grid, ox, oy);
    const r = view.circle.radius;
    view.circle.setPosition(pos.x, pos.y);
    view.label.setPosition(pos.x, pos.y - r - 10);
    view.label.setText(`${pawn.name}\n${formatPawnMapHudBody(pawn)}`);

    const wid = pawn.activeWorkItemId;
    const item = wid ? workItems.get(wid) : undefined;
    const anchorCenter =
      item !== undefined ? cellCenterWorld(grid, item.anchorCell, ox, oy) : pos;
    const barTopY =
      item !== undefined
        ? anchorCenter.y -
          grid.cellSizePx * 0.5 -
          WORK_BAR_ABOVE_ANCHOR_PX -
          WORK_BAR_HEIGHT_PX / 2
        : pos.y - r - WORK_BAR_ABOVE_ANCHOR_PX - WORK_BAR_HEIGHT_PX / 2;
    view.workBarBg.setPosition(anchorCenter.x, barTopY);
    view.workBarFill.setPosition(anchorCenter.x - WORK_BAR_WIDTH_PX / 2, barTopY);
    const totalSec =
      item !== undefined ? workItemAnchorDurationSeconds(workItemAnchorDurationSec, item.kind) : undefined;
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
