import type { EntityRegistry } from "./entity-system";
import { ZONE_TYPE_STORAGE } from "./entity-system";
import type { GridCoord } from "./world-grid";
import { gridCoordFromKey, isWalkableCell, type WorldGridConfig } from "./world-grid";

export function isStorageZoneType(zoneType: string): boolean {
  return zoneType === ZONE_TYPE_STORAGE;
}

export function cellHasStorageZoneStaticBlock(registry: EntityRegistry, cell: GridCoord): boolean {
  for (const e of registry.listEntitiesAtCell(cell)) {
    if (e.kind === "tree" || e.kind === "rock" || e.kind === "building" || e.kind === "blueprint") {
      return true;
    }
  }
  return false;
}

export function storageZoneOccupiedCellKeys(registry: EntityRegistry): Set<string> {
  const s = new Set<string>();
  for (const z of registry.listEntitiesByKind("zone")) {
    if (!isStorageZoneType(z.zoneType)) continue;
    for (const k of z.cellKeys) s.add(k);
  }
  return s;
}

export function isCellEligibleForStorageZone(
  registry: EntityRegistry,
  grid: WorldGridConfig,
  cellKey: string,
  occupiedByExistingStorage: ReadonlySet<string>
): boolean {
  const coord = gridCoordFromKey(cellKey);
  if (!coord) return false;
  if (!isWalkableCell(grid, coord)) return false;
  if (occupiedByExistingStorage.has(cellKey)) return false;
  if (cellHasStorageZoneStaticBlock(registry, coord)) return false;
  for (const e of registry.listEntitiesAtCell(coord)) {
    if (e.kind === "material" && e.containerKind === "map") return false;
  }
  return true;
}

export function filterCellKeysForNewStorageZone(
  registry: EntityRegistry,
  grid: WorldGridConfig,
  cellKeys: ReadonlySet<string>
): string[] {
  const occupied = storageZoneOccupiedCellKeys(registry);
  const out: string[] = [];
  for (const key of cellKeys) {
    if (isCellEligibleForStorageZone(registry, grid, key, occupied)) out.push(key);
  }
  return out;
}

export function nextStorageZoneEntityId(registry: EntityRegistry): string {
  let max = 0;
  for (const z of registry.listEntitiesByKind("zone")) {
    const m = /^storage-zone-(\d+)$/.exec(z.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `storage-zone-${max + 1}`;
}
