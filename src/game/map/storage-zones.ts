import type { ResourceMaterialKind, WorldEntitySnapshot } from "../entity/entity-types";
import type { WorldCore } from "../world-core-types";
import { coordKey, type GridCoord } from "./world-grid";

export type StorageFilterMode = "allow-all" | "allow-list";

export type StorageGroupSnapshot = Readonly<{
  groupKey: string;
  zoneIds: readonly string[];
  cells: readonly GridCoord[];
  anchorCell: GridCoord;
  displayName: string;
  filterMode: StorageFilterMode;
  allowedMaterialKinds: readonly ResourceMaterialKind[];
}>;

export type StorageGroupLabel = Readonly<{
  groupKey: string;
  text: string;
  anchorCell: GridCoord;
}>;

export type AvailableStorageCell = Readonly<{
  zoneId: string;
  cell: GridCoord;
  groupKey: string;
}>;

type ZoneLike = Readonly<{
  id: string;
  coveredCells?: readonly GridCoord[];
  storageGroupDisplayName?: string;
  storageFilterMode?: StorageFilterMode;
  allowedMaterialKinds?: readonly ResourceMaterialKind[];
  acceptedMaterialKinds?: readonly ResourceMaterialKind[];
  zoneKind?: string;
}>;

function cloneCell(cell: GridCoord): GridCoord {
  return { col: cell.col, row: cell.row };
}

function sortCells(cells: readonly GridCoord[]): GridCoord[] {
  return [...cells].sort((left, right) => {
    const rowDiff = left.row - right.row;
    if (rowDiff !== 0) return rowDiff;
    return left.col - right.col;
  });
}

function sortIds(ids: Iterable<string>): string[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function storageZonesFrom(world: WorldCore | Iterable<WorldEntitySnapshot>): ZoneLike[] {
  const entities =
    Symbol.iterator in Object(world) && !("entities" in Object(world))
      ? world as Iterable<WorldEntitySnapshot>
      : (world as WorldCore).entities.values();
  const zones: ZoneLike[] = [];
  for (const entity of entities) {
    if (entity.kind === "zone" && entity.zoneKind === "storage") {
      zones.push(entity);
    }
  }
  return zones;
}

function orthogonalNeighborKeys(cell: GridCoord): readonly string[] {
  return [
    coordKey({ col: cell.col - 1, row: cell.row }),
    coordKey({ col: cell.col + 1, row: cell.row }),
    coordKey({ col: cell.col, row: cell.row - 1 }),
    coordKey({ col: cell.col, row: cell.row + 1 })
  ];
}

function zoneCellOwners(zones: readonly ZoneLike[]): Map<string, string[]> {
  const byCell = new Map<string, string[]>();
  for (const zone of zones) {
    for (const cell of zone.coveredCells ?? []) {
      const key = coordKey(cell);
      const zoneIds = byCell.get(key) ?? [];
      zoneIds.push(zone.id);
      byCell.set(key, zoneIds);
    }
  }
  for (const zoneIds of byCell.values()) {
    zoneIds.sort((left, right) => left.localeCompare(right));
  }
  return byCell;
}

export function storageCellLockedMaterial(
  world: WorldCore | Iterable<WorldEntitySnapshot>,
  cell: GridCoord
): ResourceMaterialKind | undefined {
  const entities =
    Symbol.iterator in Object(world) && !("entities" in Object(world))
      ? world as Iterable<WorldEntitySnapshot>
      : (world as WorldCore).entities.values();
  const key = coordKey(cell);
  for (const entity of entities) {
    if (entity.kind !== "resource") continue;
    if (entity.containerKind !== "zone") continue;
    if (coordKey(entity.cell) !== key) continue;
    return entity.materialKind;
  }
  return undefined;
}

function zoneResourcesAtCell(
  world: WorldCore,
  cell: GridCoord
): WorldEntitySnapshot[] {
  const key = coordKey(cell);
  const resources: WorldEntitySnapshot[] = [];
  for (const entity of world.entities.values()) {
    if (entity.kind !== "resource") continue;
    if (entity.containerKind !== "zone") continue;
    if (coordKey(entity.cell) !== key) continue;
    resources.push(entity);
  }
  return resources.sort((left, right) => left.id.localeCompare(right.id));
}

function zoneAllowsMaterial(zone: ZoneLike, materialKind: ResourceMaterialKind): boolean {
  const filterMode = zone.storageFilterMode ?? "allow-all";
  const allowed =
    zone.allowedMaterialKinds ?? zone.acceptedMaterialKinds ?? [];
  if (filterMode === "allow-all") {
    return true;
  }
  return allowed.includes(materialKind);
}

function isResourceStackable(resource: WorldEntitySnapshot): boolean {
  return resource.stackable ?? true;
}

function groupDisplayName(zones: readonly ZoneLike[]): string {
  return (
    zones.find((zone) => zone.storageGroupDisplayName?.trim())?.storageGroupDisplayName ??
    zones[0]?.storageGroupDisplayName ??
    "存储区"
  );
}

function groupFilterMode(zones: readonly ZoneLike[]): StorageFilterMode {
  return zones.find((zone) => zone.storageFilterMode)?.storageFilterMode ?? "allow-all";
}

function groupAllowedKinds(zones: readonly ZoneLike[]): ResourceMaterialKind[] {
  const seen = new Set<ResourceMaterialKind>();
  const out: ResourceMaterialKind[] = [];
  for (const zone of zones) {
    for (const material of zone.allowedMaterialKinds ?? zone.acceptedMaterialKinds ?? []) {
      if (seen.has(material)) continue;
      seen.add(material);
      out.push(material);
    }
  }
  return out;
}

export function listStorageGroups(world: WorldCore | Iterable<WorldEntitySnapshot>): StorageGroupSnapshot[] {
  const zones = storageZonesFrom(world);
  const byId = new Map(zones.map((zone) => [zone.id, zone] as const));
  const cellOwners = zoneCellOwners(zones);
  const sortedKeys = [...cellOwners.keys()].sort((left, right) => {
    const [leftCol, leftRow] = left.split(",").map(Number);
    const [rightCol, rightRow] = right.split(",").map(Number);
    const rowDiff = leftRow - rightRow;
    if (rowDiff !== 0) return rowDiff;
    return leftCol - rightCol;
  });
  const visited = new Set<string>();
  const groups: StorageGroupSnapshot[] = [];

  for (const startKey of sortedKeys) {
    if (visited.has(startKey)) continue;
    const queue = [startKey];
    const cellKeys: string[] = [];
    const zoneIds = new Set<string>();
    visited.add(startKey);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cellKeys.push(current);
      for (const zoneId of cellOwners.get(current) ?? []) {
        zoneIds.add(zoneId);
      }
      const [col, row] = current.split(",").map(Number);
      for (const neighborKey of orthogonalNeighborKeys({ col, row })) {
        if (visited.has(neighborKey)) continue;
        if (!cellOwners.has(neighborKey)) continue;
        visited.add(neighborKey);
        queue.push(neighborKey);
      }
    }

    const cells = sortCells(
      cellKeys.map((key) => {
        const [col, row] = key.split(",").map(Number);
        return { col, row };
      })
    );
    const sortedZoneIds = sortIds(zoneIds);
    const groupZones = sortedZoneIds.map((zoneId) => byId.get(zoneId)!).filter(Boolean);
    groups.push({
      groupKey: cells.map((cell) => coordKey(cell)).join("|"),
      zoneIds: sortedZoneIds,
      cells,
      anchorCell: cloneCell(cells[0]!),
      displayName: groupDisplayName(groupZones),
      filterMode: groupFilterMode(groupZones),
      allowedMaterialKinds: groupAllowedKinds(groupZones)
    });
  }

  return groups;
}

export function resolveStorageGroupAtCell(
  world: WorldCore | Iterable<WorldEntitySnapshot>,
  cell: GridCoord
): StorageGroupSnapshot | undefined {
  const key = coordKey(cell);
  return listStorageGroups(world).find((group) => group.cells.some((c) => coordKey(c) === key));
}

export function listStorageGroupLabels(
  world: WorldCore | Iterable<WorldEntitySnapshot>
): StorageGroupLabel[] {
  return listStorageGroups(world).map((group) => ({
    groupKey: group.groupKey,
    text: group.displayName,
    anchorCell: cloneCell(group.anchorCell)
  }));
}

function cellAvailableForResource(
  world: WorldCore,
  cell: GridCoord,
  resource: WorldEntitySnapshot
): boolean {
  const existing = zoneResourcesAtCell(world, cell);
  if (existing.length === 0) {
    return true;
  }

  const [primary] = existing;
  if (!primary || primary.materialKind !== resource.materialKind) {
    return false;
  }

  if (!isResourceStackable(primary) || !isResourceStackable(resource)) {
    return false;
  }

  return true;
}

export function findAvailableStorageCell(
  world: WorldCore,
  resourceEntityId: string
): AvailableStorageCell | undefined {
  const resource = world.entities.get(resourceEntityId);
  if (!resource || resource.kind !== "resource") return undefined;

  const zones = storageZonesFrom(world);
  const groups = listStorageGroups(world);

  // Prefer stacking into an existing compatible stack before using an empty slot.
  for (const pass of [0, 1] as const) {
    for (const group of groups) {
      const allowedByGroup =
        group.filterMode === "allow-all" || group.allowedMaterialKinds.includes(resource.materialKind ?? "generic");
      if (!allowedByGroup) continue;

      for (const cell of group.cells) {
        const zoneIdsForCell = zones
          .filter((zone) => (zone.coveredCells ?? []).some((covered) => coordKey(covered) === coordKey(cell)))
          .map((zone) => zone.id)
          .sort((left, right) => left.localeCompare(right));
        const zoneId = zoneIdsForCell[0];
        if (!zoneId) continue;
        const zone = zones.find((entry) => entry.id === zoneId)!;
        if (!zoneAllowsMaterial(zone, resource.materialKind ?? "generic")) continue;

        const existing = zoneResourcesAtCell(world, cell);
        const wantsExistingStack = pass === 0;
        if (wantsExistingStack && existing.length === 0) continue;
        if (!wantsExistingStack && existing.length > 0) continue;
        if (!cellAvailableForResource(world, cell, resource)) continue;
        return {
          zoneId,
          cell: cloneCell(cell),
          groupKey: group.groupKey
        };
      }
    }
  }

  return undefined;
}
