import type { EntityId, EntityRegistry, ZoneEntity } from "./entity-system";
import { cellHasStorageZoneStaticBlock, isStorageZoneType } from "./storage-zone";
import type { WorkId, WorkOrder, WorkRegistry } from "./work-system";
import {
  gridCoordFromKey,
  isInsideGrid,
  isWalkableCell,
  type GridCoord,
  type WorldGridConfig
} from "./world-grid";

export const WORK_TYPE_STOCKPILE_DEPOSIT = "stockpile-deposit" as const;
export const WORK_REASON_STOCKPILE_DEPOSIT = "stockpile_deposit";

export const STOCKPILE_DEPOSIT_PRIORITY = 60;

export function zoneAcceptsMaterial(zone: ZoneEntity, materialKind: string): boolean {
  const rules = zone.acceptedMaterialRules;
  if (rules.length === 0) return true;
  if (rules.includes("*")) return true;
  return rules.includes(materialKind);
}

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function isDepositCellLockedByOther(
  workRegistry: WorkRegistry,
  cell: GridCoord,
  selfPawnId: string
): boolean {
  const ids = workRegistry.listWorkIdsLockedOnTarget({ kind: "cell", cell });
  for (const wid of ids) {
    const r = workRegistry.getReservation(wid);
    if (r && r.pawnId !== selfPawnId) return true;
  }
  return false;
}

export function findStockpileDepositCell(
  grid: WorldGridConfig,
  registry: EntityRegistry,
  workRegistry: WorkRegistry,
  pawnId: string,
  pawnCell: GridCoord,
  materialKind: string
): { zoneId: EntityId; cell: GridCoord } | undefined {
  const zones = registry
    .listEntitiesByKind("zone")
    .filter((z): z is ZoneEntity => isStorageZoneType(z.zoneType));
  if (!zones.length) return undefined;

  type Scored = { zoneId: EntityId; cell: GridCoord; dist: number };
  const candidates: Scored[] = [];

  for (const zone of zones) {
    if (!zoneAcceptsMaterial(zone, materialKind)) continue;
    for (const key of zone.cellKeys) {
      const cell = gridCoordFromKey(key);
      if (!cell || !isInsideGrid(grid, cell)) continue;
      if (!isWalkableCell(grid, cell)) continue;
      if (cellHasStorageZoneStaticBlock(registry, cell)) continue;
      const stack = registry.groundMaterialAtCell(cell);
      if (stack && stack.materialKind !== materialKind) continue;
      if (isDepositCellLockedByOther(workRegistry, cell, pawnId)) continue;
      candidates.push({ zoneId: zone.id, cell, dist: manhattan(pawnCell, cell) });
    }
  }

  candidates.sort((a, b) => a.dist - b.dist || a.zoneId.localeCompare(b.zoneId));
  const best = candidates[0];
  return best ? { zoneId: best.zoneId, cell: best.cell } : undefined;
}

export function stockpileDepositWorkIdForPawn(pawnId: EntityId): WorkId {
  return `stockpile-deposit:${pawnId}`;
}

export function upsertPendingStockpileDepositWork(
  workRegistry: WorkRegistry,
  pawnId: EntityId,
  zoneId: EntityId,
  cell: GridCoord
): WorkId {
  const id = stockpileDepositWorkIdForPawn(pawnId);
  const existing = workRegistry.getWork(id);
  if (existing?.status === "in_progress") {
    return id;
  }
  const next: WorkOrder = {
    id,
    workType: WORK_TYPE_STOCKPILE_DEPOSIT,
    status: "pending",
    targetEntityId: zoneId,
    targetCell: cell,
    reason: WORK_REASON_STOCKPILE_DEPOSIT,
    priority: STOCKPILE_DEPOSIT_PRIORITY
  };
  if (existing) {
    workRegistry.updateWork(next);
  } else {
    workRegistry.registerWork(next);
  }
  return id;
}

export function removePendingStockpileDepositWorkIfPresent(
  workRegistry: WorkRegistry,
  pawnId: EntityId
): void {
  const id = stockpileDepositWorkIdForPawn(pawnId);
  const w = workRegistry.getWork(id);
  if (w?.status === "pending") {
    workRegistry.removeWork(id);
  }
}
