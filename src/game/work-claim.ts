import type { ClaimableWorkBrief } from "./goal-driven-planning";
import type { EntityRegistry } from "./entity-system";
import type { WorkRegistry } from "./work-system";
import { WORK_TYPE_FELLING, WORK_TYPE_MINING, WORK_TYPE_PICKUP } from "./work-generation";
import { WORK_TYPE_STOCKPILE_DEPOSIT } from "./stockpile-deposit";
import {
  coordKey,
  isCellOccupiedByOthers,
  isWalkableCell,
  orthogonalNeighbors,
  type GridCoord,
  type WorldGridConfig
} from "./world-grid";

function workApproachCells(grid: WorldGridConfig, targetCell: GridCoord): GridCoord[] {
  return orthogonalNeighbors(grid, targetCell).filter((c) => isWalkableCell(grid, c));
}

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

export function buildClaimablePendingWorks(
  registry: EntityRegistry,
  workRegistry: WorkRegistry,
  grid: WorldGridConfig
): ClaimableWorkBrief[] {
  const out: ClaimableWorkBrief[] = [];
  for (const w of workRegistry.listPending()) {
    if (!w.targetEntityId) continue;
    const ent = registry.getEntity(w.targetEntityId);
    if (!ent) continue;
    if (w.workType === WORK_TYPE_FELLING) {
      if (ent.kind !== "tree" || !ent.lumberMarked || ent.occupied) continue;
      if (workApproachCells(grid, w.targetCell).length === 0) continue;
    } else if (w.workType === WORK_TYPE_MINING) {
      if (ent.kind !== "rock" || !ent.miningMarked || ent.occupied) continue;
      if (workApproachCells(grid, w.targetCell).length === 0) continue;
    } else if (w.workType === WORK_TYPE_PICKUP) {
      if (ent.kind !== "material" || ent.containerKind !== "map" || !ent.pickupMarked || ent.reservedByPawnId) {
        continue;
      }
      if (!isWalkableCell(grid, w.targetCell)) continue;
    } else continue;
    out.push({
      id: w.id,
      workType: w.workType,
      targetCell: w.targetCell,
      targetEntityId: w.targetEntityId,
      priority: w.priority
    });
  }
  return out.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

export function pickWorkAnchorCell(
  grid: WorldGridConfig,
  pawnCell: GridCoord,
  pawnId: string,
  logicalCellsByPawnId: ReadonlyMap<string, GridCoord>,
  w: ClaimableWorkBrief
): GridCoord | undefined {
  if (w.workType === WORK_TYPE_PICKUP || w.workType === WORK_TYPE_STOCKPILE_DEPOSIT) {
    const cell = w.targetCell;
    if (!isWalkableCell(grid, cell)) return undefined;
    if (isCellOccupiedByOthers(logicalCellsByPawnId, cell, pawnId)) return undefined;
    return cell;
  }
  if (w.workType === WORK_TYPE_FELLING || w.workType === WORK_TYPE_MINING) {
    const candidates = workApproachCells(grid, w.targetCell).filter(
      (c) => !isCellOccupiedByOthers(logicalCellsByPawnId, c, pawnId)
    );
    if (!candidates.length) return undefined;
    return candidates.sort((a, b) => manhattan(pawnCell, a) - manhattan(pawnCell, b))[0];
  }
  return undefined;
}

export function isAtWorkSite(
  grid: WorldGridConfig,
  pawnCell: GridCoord,
  w: Pick<ClaimableWorkBrief, "workType" | "targetCell">
): boolean {
  if (w.workType === WORK_TYPE_PICKUP || w.workType === WORK_TYPE_STOCKPILE_DEPOSIT) {
    return coordKey(pawnCell) === coordKey(w.targetCell);
  }
  if (w.workType === WORK_TYPE_FELLING || w.workType === WORK_TYPE_MINING) {
    return orthogonalNeighbors(grid, w.targetCell).some(
      (n) => n.col === pawnCell.col && n.row === pawnCell.row
    );
  }
  return false;
}
