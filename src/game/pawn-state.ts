/** pawn-state：小人逻辑格、移动过渡与显示用派生数据（与 Phaser 无关）。 */

import type { GridCoord, WorldGridConfig } from "./world-grid";
import { cellCenterWorld } from "./world-grid";

export const DEFAULT_PAWN_NAMES = [
  "Alex",
  "VC",
  "toastoffee",
  "yulu",
  "SG"
] as const;

export type PawnId = string;

export type PawnState = Readonly<{
  id: PawnId;
  name: string;
  /** 未在移动或移动未完成时，表示当前所占逻辑格。移动中为起点格。 */
  logicalCell: GridCoord;
  /** 移动中的目标格；非移动时为 undefined。 */
  moveTarget: GridCoord | undefined;
  /** 0..1，非移动时应为 0。 */
  moveProgress01: number;
  /** 占位圆颜色（十六进制 0xRRGGBB）。 */
  fillColor: number;
}>;

export function createDefaultPawnStates(
  spawnPoints: readonly GridCoord[],
  names: readonly string[] = DEFAULT_PAWN_NAMES
): PawnState[] {
  if (spawnPoints.length !== names.length) {
    throw new Error("pawn-state: spawn points count must match names count");
  }
  const palette = [0xe07a5f, 0x81b29a, 0x3d405b, 0xf2cc8f, 0x9b5de5];
  return names.map((name, i) => ({
    id: `pawn-${i}`,
    name,
    logicalCell: spawnPoints[i]!,
    moveTarget: undefined,
    moveProgress01: 0,
    fillColor: palette[i % palette.length]!
  }));
}

export function isMoving(pawn: PawnState): boolean {
  return pawn.moveTarget !== undefined;
}

export function beginMove(pawn: PawnState, target: GridCoord): PawnState {
  return {
    ...pawn,
    moveTarget: target,
    moveProgress01: 0
  };
}

export function withMoveProgress(pawn: PawnState, progress01: number): PawnState {
  const p = Math.max(0, Math.min(1, progress01));
  return { ...pawn, moveProgress01: p };
}

export function finishMoveIfComplete(pawn: PawnState): PawnState {
  if (!pawn.moveTarget || pawn.moveProgress01 < 1) return pawn;
  return {
    ...pawn,
    logicalCell: pawn.moveTarget,
    moveTarget: undefined,
    moveProgress01: 0
  };
}

/** 平滑缓动，视觉略好于线性。 */
export function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function logicalCellsByPawnId(
  pawns: readonly PawnState[]
): Map<PawnId, GridCoord> {
  const m = new Map<PawnId, GridCoord>();
  for (const p of pawns) m.set(p.id, p.logicalCell);
  return m;
}

export function advanceMoveTowardTarget(
  pawn: PawnState,
  deltaSeconds: number,
  moveDurationSeconds: number
): PawnState {
  if (!pawn.moveTarget || moveDurationSeconds <= 0) return pawn;
  const next = pawn.moveProgress01 + deltaSeconds / moveDurationSeconds;
  return withMoveProgress(pawn, next);
}

export function pawnDisplayWorldCenter(
  pawn: PawnState,
  grid: WorldGridConfig,
  gridOriginXPx: number,
  gridOriginYPx: number
): Readonly<{ x: number; y: number }> {
  const from = cellCenterWorld(grid, pawn.logicalCell, gridOriginXPx, gridOriginYPx);
  if (!pawn.moveTarget) return from;
  const to = cellCenterWorld(grid, pawn.moveTarget, gridOriginXPx, gridOriginYPx);
  const t = smoothstep01(pawn.moveProgress01);
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t
  };
}
