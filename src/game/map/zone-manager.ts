/**
 * 区域（Zone）创建、查询与格集合校验；与 {@link ZoneEntity} / {@link EntityRegistry} 对齐。
 *
 * **职责边界**：若策划要求存储区实体持有「当前存储物资」列表，应在 {@link ZoneEntity} 与实体生命周期规则中建模，
 * 并由工作/搬运流程维护一致性。本模块仅负责格集合与向注册表创建/移除区域，不维护物资清单。
 */

import type { EntityRegistry } from "../entity/entity-registry";
import type { EntityId, ResourceMaterialKind, ZoneEntity, ZoneKind } from "../entity/entity-types";
import { coordKey, parseCoordKey, type GridCoord } from "./world-grid";
import { getOccupant } from "./occupancy-manager";

/** 格集合校验结果：`ok: true` 表示通过；否则携带失败原因与首个相关格（若有）。 */
export type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: ZoneCellsValidationFailureReason;
      /** 与 `duplicate_cell` / `cell_occupied` 等相关时的格。 */
      cell?: GridCoord;
      /** 与 `cell_occupied` 同时出现。 */
      occupantId?: string;
    };

export type ZoneCellsValidationFailureReason = "empty" | "duplicate_cell" | "cell_occupied";

/**
 * 覆盖格集合的轴对齐最小外接矩形（派生视图）。
 *
 * 设计文档中的「边界范围」等可由本类型从区域实体的 `coveredCells` 即时算出；不写入实体、非
 * `zone-manager` 的持久职责，供区域创建校验或地图投影统一调用。
 */
export type ZoneCoveredCellsAxisBounds = Readonly<{
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}>;

/** 空集合返回 `undefined`。 */
export function axisAlignedBoundsFromCoveredCells(
  cells: readonly GridCoord[]
): ZoneCoveredCellsAxisBounds | undefined {
  if (cells.length === 0) return undefined;
  let minCol = cells[0]!.col;
  let maxCol = minCol;
  let minRow = cells[0]!.row;
  let maxRow = minRow;
  for (let i = 1; i < cells.length; i++) {
    const c = cells[i]!;
    if (c.col < minCol) minCol = c.col;
    if (c.col > maxCol) maxCol = c.col;
    if (c.row < minRow) minRow = c.row;
    if (c.row > maxRow) maxRow = c.row;
  }
  return { minCol, maxCol, minRow, maxRow };
}

/**
 * 四邻域连通分量个数；空集合为 `0`。
 *
 * 与 {@link axisAlignedBoundsFromCoveredCells} 同为「连通性信息」的派生度量，非实体字段。
 */
export function connectedComponentCountFromCoveredCells(cells: readonly GridCoord[]): number {
  if (cells.length === 0) return 0;
  const keySet = new Set<string>();
  for (const c of cells) {
    keySet.add(coordKey(c));
  }
  const visited = new Set<string>();
  let components = 0;
  for (const key of keySet) {
    if (visited.has(key)) continue;
    components++;
    const stack: string[] = [key];
    visited.add(key);
    while (stack.length > 0) {
      const k = stack.pop()!;
      const p = parseCoordKey(k);
      if (!p) continue;
      for (const n of [
        coordKey({ col: p.col - 1, row: p.row }),
        coordKey({ col: p.col + 1, row: p.row }),
        coordKey({ col: p.col, row: p.row - 1 }),
        coordKey({ col: p.col, row: p.row + 1 })
      ]) {
        if (!keySet.has(n) || visited.has(n)) continue;
        visited.add(n);
        stack.push(n);
      }
    }
  }
  return components;
}

/**
 * 校验区域覆盖格集合是否可用于创建区域（不涉及地图边界：边界由调用方用 {@link isInsideGrid} 等另行保证）。
 *
 * - **非空**：`cells.length === 0` 失败。
 * - **无重复坐标**：同一 `coordKey` 出现多次则失败（返回第二次及以后的重复格之一）。
 * - **不与占用冲突**：`occupancy` 中任一格已有占有人则失败（返回首个冲突格与占有人 id）。
 */
export function validateZoneCells(
  cells: readonly GridCoord[],
  occupancy: ReadonlyMap<string, ReadonlySet<string>>
): ValidationResult {
  if (cells.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const seen = new Set<string>();
  for (const cell of cells) {
    const key = coordKey(cell);
    if (seen.has(key)) {
      return { ok: false, reason: "duplicate_cell", cell: { ...cell } };
    }
    seen.add(key);
  }

  for (const cell of cells) {
    const occupantId = getOccupant(occupancy, cell);
    if (occupantId !== undefined) {
      return { ok: false, reason: "cell_occupied", cell: { ...cell }, occupantId };
    }
  }

  return { ok: true };
}

function uniqueCoveredCells(cells: readonly GridCoord[]): GridCoord[] {
  const seen = new Set<string>();
  const out: GridCoord[] = [];
  for (const c of cells) {
    const key = coordKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ col: c.col, row: c.row });
  }
  return out;
}

/**
 * 在注册表中创建一块区域：`coveredCells` 按坐标去重并保留首次出现顺序；`acceptedResourceTypes` 对应实体上的 `acceptedMaterialKinds`。
 *
 * 创建前对去重后的格集合调用 {@link validateZoneCells}（占用冲突等与校验函数一致）。
 *
 * @throws 去重后无格、或校验未通过时抛出（含占用冲突等明确信息）。
 */
export function createZone(
  registry: EntityRegistry,
  cells: readonly GridCoord[],
  occupancy: ReadonlyMap<string, ReadonlySet<string>>,
  zoneType: ZoneKind,
  name: string,
  acceptedResourceTypes: readonly ResourceMaterialKind[]
): ZoneEntity {
  const coveredCells = uniqueCoveredCells(cells);
  if (coveredCells.length === 0) {
    throw new Error("createZone: cells must be non-empty");
  }

  const validation = validateZoneCells(coveredCells, occupancy);
  if (!validation.ok) {
    if (validation.reason === "cell_occupied") {
      const c = validation.cell!;
      throw new Error(`createZone: cell (${c.col},${c.row}) is occupied by ${validation.occupantId}`);
    }
    throw new Error(`createZone: zone cells validation failed: ${validation.reason}`);
  }

  const draft = {
    kind: "zone" as const,
    zoneKind: zoneType,
    coveredCells,
    name,
    acceptedMaterialKinds: [...acceptedResourceTypes]
  };

  return registry.create(draft) as ZoneEntity;
}

/** 从注册表移除指定 id 的区域；若不存在或非 `zone` 种类则静默不修改。 */
export function removeZone(registry: EntityRegistry, zoneId: EntityId): void {
  const e = registry.get(zoneId);
  if (!e || e.kind !== "zone") return;
  registry.remove(zoneId);
}

/**
 * 返回覆盖该格的任意一个区域。
 *
 * **多区域重叠时的规则**：若多块 `zone` 均覆盖同一格，返回其中 **实体 `id` 按 Unicode 码点字典序最小** 的那一块，保证结果确定、与创建顺序无关。
 */
export function getZoneAtCell(registry: EntityRegistry, cell: GridCoord): ZoneEntity | undefined {
  const zones: ZoneEntity[] = [];
  for (const e of registry.getByCell(cell)) {
    if (e.kind === "zone") zones.push(e);
  }
  if (zones.length === 0) return undefined;
  zones.sort((a, b) => a.id.localeCompare(b.id));
  return zones[0];
}

/** 返回当前注册表中指定 `zoneKind` 的全部区域（无序，与 {@link EntityRegistry.getByKind} 遍历顺序一致）。 */
export function getZonesByType(registry: EntityRegistry, type: ZoneKind): ZoneEntity[] {
  return registry.getByKind("zone").filter((e): e is ZoneEntity => e.kind === "zone" && e.zoneKind === type);
}
