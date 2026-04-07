import type { ResourceMaterialKind, WorldEntitySnapshot } from "../entity/entity-types";
import type { WorldCore } from "../world-core-types";
import { getOccupants } from "./occupancy-manager";
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

/** 具备 {@link WorldCore.entities} 与 {@link WorldCore.occupancy} 时可按格键查 occupant id，避免扫全表。 */
function hasEntityOccupancyIndex(world: unknown): world is WorldCore {
  return (
    typeof world === "object" &&
    world !== null &&
    "entities" in world &&
    "occupancy" in world &&
    (world as WorldCore).entities instanceof Map &&
    (world as WorldCore).occupancy instanceof Map
  );
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
  const key = coordKey(cell);
  if (hasEntityOccupancyIndex(world)) {
    for (const id of getOccupants(world.occupancy, cell)) {
      const entity = world.entities.get(id);
      if (!entity || entity.kind !== "resource") continue;
      if (entity.containerKind !== "zone") continue;
      if (coordKey(entity.cell) !== key) continue;
      return entity.materialKind;
    }
    return undefined;
  }
  const entities =
    Symbol.iterator in Object(world) && !("entities" in Object(world))
      ? world
      : (world as unknown as WorldCore).entities.values();
  for (const entity of entities) {
    if (entity.kind !== "resource") continue;
    if (entity.containerKind !== "zone") continue;
    if (coordKey(entity.cell) !== key) continue;
    return entity.materialKind;
  }
  return undefined;
}

/** 仅实体映射，供 {@link findAvailableStorageCell} 在无完整 {@link WorldCore} 时查询存储格。 */
export type StorageEntityLookup = Readonly<{
  entities: Map<string, WorldEntitySnapshot>;
}>;

function zoneResourcesAtCell(
  lookup: StorageEntityLookup | WorldCore,
  cell: GridCoord
): WorldEntitySnapshot[] {
  const key = coordKey(cell);
  const byId = new Map<string, WorldEntitySnapshot>();

  const consider = (entity: WorldEntitySnapshot | undefined) => {
    if (!entity || entity.kind !== "resource") return;
    if (entity.containerKind !== "zone") return;
    if (coordKey(entity.cell) !== key) return;
    byId.set(entity.id, entity);
  };

  if (hasEntityOccupancyIndex(lookup)) {
    for (const id of getOccupants(lookup.occupancy, cell)) {
      consider(lookup.entities.get(id));
    }
  }
  /** 库区物资以 entity.cell 为真源；未必写入占用图（避免与地面小人脚印同一索引冲突）。全表合并，与工单结算侧 zone 扫描口径一致。 */
  for (const entity of lookup.entities.values()) {
    consider(entity);
  }

  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function zoneAllowsMaterial(zone: ZoneLike, materialKind: ResourceMaterialKind): boolean {
  const filterMode = zone.storageFilterMode ?? "allow-all";
  const allowed = zone.acceptedMaterialKinds ?? [];
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

/**
 * 正交相邻的多个存储区 zone 合并为同一 {@link StorageGroupSnapshot} 时，分组级过滤模式按以下规则确定：
 * - `zones` 须已按 zone.id 字典序排列（与 {@link listStorageGroups} 中 `sortedZoneIds` 一致）。
 * - 取其中**首个**已设置 `storageFilterMode` 的 zone 的值；若均未设置则视为 `"allow-all"`。
 *
 * 按格放置物资时仍须叠加该格所属 zone（同格多 zone 时取 id 最小者）的 {@link zoneAllowsMaterial}，见 {@link findAvailableStorageCell}。
 */
function mergedGroupStorageFilterMode(zones: readonly ZoneLike[]): StorageFilterMode {
  return zones.find((zone) => zone.storageFilterMode)?.storageFilterMode ?? "allow-all";
}

/**
 * 合并分组内各存储区的允许材质列表：**并集**，去重；遍历 zone 的顺序与 `zones` 一致（字典序 id）。
 * 与 {@link mergedGroupStorageFilterMode} 组合构成 UI/分组级快照；单格是否可放仍由 {@link zoneAllowsMaterial} 判定。
 */
function mergedGroupAllowedMaterialKinds(zones: readonly ZoneLike[]): ResourceMaterialKind[] {
  const seen = new Set<ResourceMaterialKind>();
  const out: ResourceMaterialKind[] = [];
  for (const zone of zones) {
    for (const material of zone.acceptedMaterialKinds ?? []) {
      if (seen.has(material)) continue;
      seen.add(material);
      out.push(material);
    }
  }
  return out;
}

function buildStorageGroupsFromZones(zones: readonly ZoneLike[]): StorageGroupSnapshot[] {
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
      filterMode: mergedGroupStorageFilterMode(groupZones),
      allowedMaterialKinds: mergedGroupAllowedMaterialKinds(groupZones)
    });
  }

  return groups;
}

export function listStorageGroups(world: WorldCore | Iterable<WorldEntitySnapshot>): StorageGroupSnapshot[] {
  return buildStorageGroupsFromZones(storageZonesFrom(world));
}

export function resolveStorageGroupAtCell(
  world: WorldCore | Iterable<WorldEntitySnapshot>,
  cell: GridCoord
): StorageGroupSnapshot | undefined {
  const key = coordKey(cell);
  const zones = storageZonesFrom(world);
  const cellOwners = zoneCellOwners(zones);
  if (!cellOwners.has(key)) return undefined;

  const byId = new Map(zones.map((zone) => [zone.id, zone] as const));
  const queue = [key];
  const visited = new Set<string>([key]);
  const cellKeys: string[] = [];
  const zoneIds = new Set<string>();

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
    cellKeys.map((cellKey) => {
      const [c, r] = cellKey.split(",").map(Number);
      return { col: c, row: r };
    })
  );
  const sortedZoneIds = sortIds(zoneIds);
  const groupZones = sortedZoneIds.map((zoneId) => byId.get(zoneId)!).filter(Boolean);
  return {
    groupKey: cells.map((c) => coordKey(c)).join("|"),
    zoneIds: sortedZoneIds,
    cells,
    anchorCell: cloneCell(cells[0]!),
    displayName: groupDisplayName(groupZones),
    filterMode: mergedGroupStorageFilterMode(groupZones),
    allowedMaterialKinds: mergedGroupAllowedMaterialKinds(groupZones)
  };
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
  lookup: StorageEntityLookup | WorldCore,
  cell: GridCoord,
  resource: WorldEntitySnapshot
): boolean {
  const existing = zoneResourcesAtCell(lookup, cell);
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
  world: WorldCore | StorageEntityLookup,
  resourceEntityId: string
): AvailableStorageCell | undefined {
  const resource = world.entities.get(resourceEntityId);
  if (!resource || resource.kind !== "resource") return undefined;
  if (resource.materialKind == null) {
    console.warn(
      `[storage-zones] resource "${resourceEntityId}" has no materialKind; cannot resolve storage cell`
    );
    return undefined;
  }
  const materialKind = resource.materialKind;

  const zones = storageZonesFrom(world.entities.values());
  const groups = buildStorageGroupsFromZones(zones);

  // Prefer stacking into an existing compatible stack before using an empty slot.
  for (const pass of [0, 1] as const) {
    for (const group of groups) {
      const allowedByGroup =
        group.filterMode === "allow-all" || group.allowedMaterialKinds.includes(materialKind);
      if (!allowedByGroup) continue;

      for (const cell of group.cells) {
        const zoneIdsForCell = zones
          .filter((zone) => (zone.coveredCells ?? []).some((covered) => coordKey(covered) === coordKey(cell)))
          .map((zone) => zone.id)
          .sort((left, right) => left.localeCompare(right));
        const zoneId = zoneIdsForCell[0];
        if (!zoneId) continue;
        const zone = zones.find((entry) => entry.id === zoneId)!;
        if (!zoneAllowsMaterial(zone, materialKind)) continue;

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
