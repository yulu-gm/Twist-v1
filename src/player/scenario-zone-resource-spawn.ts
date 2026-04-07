/**
 * 场景 YAML/TS 中的 zones、resources 落格逻辑，供实机 `loadScenarioIntoGame` 与无头 `hydrateScenario` 共用，避免双端漂移。
 */

import type { ResourceMaterialKind, ZoneKind } from "../game/entity/entity-types";
import { coordKey, isInsideGrid, validateZoneCells, type GridCoord, type WorldGridConfig } from "../game/map";
import { spawnWorldEntity, type WorldCore } from "../game/world-core";
import type { SpawnOutcome } from "../game/world-internal";
import type { ScenarioResourceSpawn, ScenarioZoneSpawn } from "../headless/scenario-types";

const RESOURCE_MATERIAL_KINDS = new Set<ResourceMaterialKind>(["wood", "food", "stone", "generic"]);

const ZONE_KINDS = new Set<ZoneKind>(["storage", "forbidden", "priority-build", "custom"]);

function parseScenarioResourceMaterialKind(raw: string, errorTag: string): ResourceMaterialKind {
  if (RESOURCE_MATERIAL_KINDS.has(raw as ResourceMaterialKind)) {
    return raw as ResourceMaterialKind;
  }
  throw new Error(`${errorTag}: unknown resource materialKind "${raw}"`);
}

function parseScenarioZoneKind(raw: string | undefined, errorTag: string): ZoneKind {
  if (raw === undefined) {
    return "custom";
  }
  if (ZONE_KINDS.has(raw as ZoneKind)) {
    return raw as ZoneKind;
  }
  throw new Error(`${errorTag}: unknown zoneKind "${raw}"`);
}

function uniqueGridCoords(cells: readonly GridCoord[]): GridCoord[] {
  const seen = new Set<string>();
  const out: GridCoord[] = [];
  for (const c of cells) {
    const k = coordKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ col: c.col, row: c.row });
  }
  return out;
}

function throwUnlessSpawnCreated(
  errorTag: string,
  kind: string,
  outcome: SpawnOutcome,
  detail: string
): void {
  if (outcome.kind === "created") return;
  const reason =
    outcome.kind === "conflict"
      ? `与 ${outcome.blockingEntityId} 占格冲突`
      : outcome.kind === "invalid-draft"
        ? outcome.reason
        : `越界 (${outcome.cell.col},${outcome.cell.row})`;
  throw new Error(`${errorTag}: failed to spawn ${kind} (${detail}): ${reason}`);
}

/**
 * 按与无头 `hydrateScenario` 相同的规则写入区域实体（校验、去重、`zoneKind` 解析）。
 */
export function applyScenarioZonesToWorld(
  world: WorldCore,
  zones: readonly ScenarioZoneSpawn[] | undefined,
  grid: WorldGridConfig,
  errorTag: string
): WorldCore {
  let w = world;
  for (let zi = 0; zi < (zones ?? []).length; zi++) {
    const z = zones![zi]!;
    const cellsRaw = z.cells;
    if (cellsRaw.length === 0) {
      throw new Error(`${errorTag}: zone cells must be non-empty`);
    }
    const cells = uniqueGridCoords(cellsRaw);
    if (cells.length === 0) {
      throw new Error(`${errorTag}: zone cells must be non-empty`);
    }
    for (const c of cells) {
      if (!isInsideGrid(grid, c)) {
        throw new Error(`${errorTag}: zone cell out of grid (${c.col},${c.row})`);
      }
    }
    const validation = validateZoneCells(cells, w.occupancy);
    if (!validation.ok) {
      const cellInfo =
        validation.reason === "cell_occupied" && validation.cell
          ? ` (${validation.cell.col},${validation.cell.row}) occupant=${validation.occupantId ?? "?"}`
          : validation.cell
            ? ` (${validation.cell.col},${validation.cell.row})`
            : "";
      throw new Error(`${errorTag}: zone #${zi} validation failed: ${validation.reason}${cellInfo}`);
    }
    const zoneKind = parseScenarioZoneKind(z.zoneKind, errorTag);
    const spawned = spawnWorldEntity(w, {
      kind: "zone",
      cell: cells[0]!,
      coveredCells: cells,
      occupiedCells: [],
      zoneKind,
      acceptedMaterialKinds: [],
      label: `scenario-zone-${zoneKind}-${zi}`
    });
    throwUnlessSpawnCreated(errorTag, "zone", spawned.outcome, `#${zi}`);
    w = spawned.world;
  }
  return w;
}

/**
 * 按与无头 `hydrateScenario` 相同的规则写入地面资源实体（越界、`materialKind` 解析）。
 */
export function applyScenarioResourcesToWorld(
  world: WorldCore,
  resources: readonly ScenarioResourceSpawn[] | undefined,
  grid: WorldGridConfig,
  errorTag: string
): WorldCore {
  let w = world;
  for (let ri = 0; ri < (resources ?? []).length; ri++) {
    const r = resources![ri]!;
    if (!isInsideGrid(grid, r.cell)) {
      throw new Error(`${errorTag}: resource cell out of grid (${r.cell.col},${r.cell.row})`);
    }
    const materialKind = parseScenarioResourceMaterialKind(r.materialKind, errorTag);
    const spawned = spawnWorldEntity(w, {
      kind: "resource",
      cell: r.cell,
      occupiedCells: [r.cell],
      materialKind,
      containerKind: "ground",
      pickupAllowed: r.pickupAllowed ?? true,
      label: `scenario-resource-${materialKind}-${ri}`
    });
    throwUnlessSpawnCreated(errorTag, "resource", spawned.outcome, `#${ri}`);
    w = spawned.world;
  }
  return w;
}
