import { CellCoord, ObjectKind } from '../../core/types';
import type { GameMap } from '../../world/game-map';
import type { Pawn } from '../pawn/pawn.types';

function getBedFootprintCells(origin: CellCoord, footprint: { width: number; height: number }): CellCoord[] {
  const cells: CellCoord[] = [];

  for (let dy = 0; dy < footprint.height; dy++) {
    for (let dx = 0; dx < footprint.width; dx++) {
      cells.push({ x: origin.x + dx, y: origin.y + dy });
    }
  }

  return cells;
}

function manhattanDistance(a: CellCoord, b: CellCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function claimBedOccupancy(
  map: GameMap,
  pawn: Pawn,
  bedId: string,
): boolean {
  const bed = map.objects.getAs(bedId, ObjectKind.Building);
  if (!bed?.bed || bed.destroyed) return false;

  if (bed.bed.occupantPawnId && bed.bed.occupantPawnId !== pawn.id) {
    return false;
  }

  bed.bed.occupantPawnId = pawn.id;
  return true;
}

export function getBedSleepCell(
  map: GameMap,
  bedId: string,
): CellCoord | null {
  const bed = map.objects.getAs(bedId, ObjectKind.Building);
  if (!bed?.bed || bed.destroyed) return null;

  const footprint = bed.footprint ?? { width: 1, height: 1 };
  const footprintCells = getBedFootprintCells(bed.cell, footprint);
  if (footprintCells.length === 0) return null;

  const interactionCell = bed.interaction?.interactionCell;
  if (!interactionCell) {
    return footprintCells[0];
  }

  const center = {
    x: bed.cell.x + (footprint.width - 1) / 2,
    y: bed.cell.y + (footprint.height - 1) / 2,
  };

  return footprintCells
    .slice()
    .sort((left, right) => {
      const interactionDelta = manhattanDistance(left, interactionCell) - manhattanDistance(right, interactionCell);
      if (interactionDelta !== 0) return interactionDelta;

      const centerDelta = manhattanDistance(left, center) - manhattanDistance(right, center);
      if (centerDelta !== 0) return centerDelta;

      const rowDelta = right.y - left.y;
      if (rowDelta !== 0) return rowDelta;

      return left.x - right.x;
    })[0];
}

export function movePawnInstantly(
  map: GameMap,
  pawn: Pawn,
  targetCell: CellCoord,
): void {
  const previousCell = { x: pawn.cell.x, y: pawn.cell.y };
  pawn.cell = { x: targetCell.x, y: targetCell.y };
  map.spatial.onObjectMoved(pawn.id, previousCell, pawn.cell, pawn.footprint);
  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;
}

export function releaseOccupiedBedForPawn(
  map: GameMap | null,
  pawn: Pawn,
): void {
  const job = pawn.ai.currentJob;
  if (!map || !job || job.defId !== 'job_sleep' || !job.targetId) return;

  const bed = map.objects.getAs(job.targetId, ObjectKind.Building);
  if (!bed?.bed) return;
  if (bed.bed.occupantPawnId === pawn.id) {
    bed.bed.occupantPawnId = undefined;
  }
}
