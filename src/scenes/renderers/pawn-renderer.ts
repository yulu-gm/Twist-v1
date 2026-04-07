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
import type { WorkRegistry } from "../../game/work-system";
import { WORK_TYPE_FELLING } from "../../game/work-generation";
import { activeFellingMiningPerformAtTarget } from "../../game/pawn-work-visual";

export type PawnView = Readonly<{
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  workIcon: Phaser.GameObjects.Text;
}>;

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpColorRgb(f: number, to: number, t: number): number {
  const fr = (f >> 16) & 0xff;
  const fg = (f >> 8) & 0xff;
  const fb = f & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = lerpChannel(fr, tr, t);
  const g = lerpChannel(fg, tg, t);
  const b = lerpChannel(fb, tb, t);
  return (r << 16) | (g << 8) | b;
}

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
    const workIcon = scene.add
      .text(pos.x + radius + 8, pos.y, "", {
        fontFamily: "Segoe UI, \"Microsoft YaHei\", sans-serif",
        fontSize: "16px",
        color: "#f4e3b2"
      })
      .setOrigin(0, 0.5)
      .setVisible(false);
    views.set(pawn.id, { circle, label, workIcon });
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
    const r = view.circle.radius;
    view.workIcon.setPosition(pos.x + r + 8, pos.y);
  }
}

export function syncPawnFellingMiningPresentation(
  views: Map<string, PawnView>,
  pawns: readonly PawnState[],
  grid: WorldGridConfig,
  ox: number,
  oy: number,
  workRegistry: WorkRegistry,
  nowMs: number
): void {
  const t = nowMs * 0.001;
  for (const pawn of pawns) {
    const view = views.get(pawn.id);
    if (!view) continue;
    const pos = pawnDisplayWorldCenter(pawn, grid, ox, oy);
    const r = view.circle.radius;
    const active = activeFellingMiningPerformAtTarget(pawn, workRegistry);
    if (!active) {
      view.circle.setScale(1);
      view.circle.setRotation(0);
      view.circle.setFillStyle(pawn.fillColor, 1);
      view.workIcon.setVisible(false);
      view.workIcon.setPosition(pos.x + r + 8, pos.y);
      continue;
    }
    let pulse: number;
    let oxAnim = 0;
    let oyAnim = 0;
    let rot = 0;
    if (active.workType === WORK_TYPE_FELLING) {
      pulse = 1 + 0.11 * Math.sin(t * 6.5);
      oyAnim = 3.2 * Math.sin(t * 13);
    } else {
      pulse = 1 + 0.06 * Math.sin(t * 14);
      oxAnim = 4 * Math.sin(t * 12);
      oyAnim = 1.4 * Math.sin(t * 19);
      rot = 0.09 * Math.sin(t * 11);
    }
    const cx = pos.x + oxAnim;
    const cy = pos.y + oyAnim;
    view.circle.setPosition(cx, cy);
    view.circle.setScale(pulse);
    view.circle.setRotation(rot);
    const accent = active.workType === WORK_TYPE_FELLING ? 0x8b5a2b : 0x5a6e8c;
    const mix = Phaser.Math.Clamp(0.32 + 0.12 * Math.sin(t * 7.5), 0, 1);
    view.circle.setFillStyle(lerpColorRgb(pawn.fillColor, accent, mix), 1);
    view.label.setPosition(cx, cy - r * pulse - 10);
    view.workIcon.setText(active.workType === WORK_TYPE_FELLING ? "伐" : "采");
    view.workIcon.setVisible(true);
    view.workIcon.setPosition(cx + r * pulse + 10, cy);
  }
}

export function applyPaletteToViews(
  views: Map<string, PawnView>,
  palette: TimeOfDayPalette
): void {
  const primaryColor = `#${(palette.primaryTextColor & 0xffffff).toString(16).padStart(6, "0")}`;
  const iconHint = `#${(palette.secondaryTextColor & 0xffffff).toString(16).padStart(6, "0")}`;
  for (const view of views.values()) {
    view.label.setColor(primaryColor);
    view.workIcon.setColor(iconHint);
  }
}
