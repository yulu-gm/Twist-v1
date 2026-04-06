/**
 * 任务标记格筛选：与领域层「哪些格会实际接到工单」对齐，避免空地板铺满标记。
 */

import type { BuildingKind, WorldEntitySnapshot } from "../game/entity/entity-types";
import { safePlaceBlueprint, type WorldCore } from "../game/world-core";
import { coordKey, isInsideGrid, parseCoordKey } from "../game/map/world-grid";
import { simulationImpassableCellKeys } from "../game/world-sim-bridge";

function mergedBlockedCellKeys(world: WorldCore): ReadonlySet<string> {
  const fromEntities = simulationImpassableCellKeys(world);
  const fromGrid = world.grid.blockedCellKeys;
  if (!fromGrid || fromGrid.size === 0) return fromEntities;
  const out = new Set(fromEntities);
  for (const k of fromGrid) {
    out.add(k);
  }
  return out;
}

function findObstacleCoveringCell(world: WorldCore, cellKey: string): string | undefined {
  const cell = parseCoordKey(cellKey);
  if (!cell) return undefined;
  const k = coordKey(cell);
  for (const entity of world.entities.values()) {
    if (entity.kind !== "obstacle") continue;
    const coveredCells = entity.occupiedCells.length > 0 ? entity.occupiedCells : [entity.cell];
    if (coveredCells.some((occupantCell) => coordKey(occupantCell) === k)) {
      return entity.id;
    }
  }
  return undefined;
}

function findUnmarkedTreeCoveringCell(world: WorldCore, cellKey: string): WorldEntitySnapshot | undefined {
  for (const entity of world.entities.values()) {
    if (entity.kind !== "tree") continue;
    if (entity.loggingMarked) continue;
    const coveredCells = entity.occupiedCells.length > 0 ? entity.occupiedCells : [entity.cell];
    if (coveredCells.some((c) => coordKey(c) === cellKey)) {
      return entity;
    }
  }
  return undefined;
}

function findGroundResourceCoveringCell(world: WorldCore, cellKey: string): WorldEntitySnapshot | undefined {
  for (const entity of world.entities.values()) {
    if (entity.kind !== "resource") continue;
    if (entity.containerKind !== "ground") continue;
    const coveredCells = entity.occupiedCells.length > 0 ? entity.occupiedCells : [entity.cell];
    if (coveredCells.some((c) => coordKey(c) === cellKey)) {
      return entity;
    }
  }
  return undefined;
}

function findUnmarkedStoneObstacleCoveringCell(world: WorldCore, cellKey: string): WorldEntitySnapshot | undefined {
  for (const entity of world.entities.values()) {
    if (entity.kind !== "obstacle") continue;
    if (entity.label !== "stone") continue;
    if (entity.miningMarked) continue;
    if (entity.occupiedCells.some((c) => coordKey(c) === cellKey)) {
      return entity;
    }
  }
  return undefined;
}

function buildBlueprintKind(
  toolId: string,
  inputShape: "rect-selection" | "brush-stroke" | "single-cell"
): BuildingKind | null {
  if (toolId !== "build") return null;
  return inputShape === "brush-stroke" ? "wall" : "bed";
}

/**
 * 在世界当前状态下，玩家选中的格中哪些格会显示/叠加「已下达工具」任务标记（与工单登记口径一致，建造为逐格可行性探测）。
 */
export function filterCellKeysForToolbarTaskMarkers(
  world: WorldCore,
  toolId: string,
  inputShape: "rect-selection" | "brush-stroke" | "single-cell",
  cellKeys: ReadonlySet<string>
): Set<string> {
  const out = new Set<string>();
  if (cellKeys.size === 0) {
    return out;
  }
  if (toolId === "idle") {
    return new Set(cellKeys);
  }

  const blocked = mergedBlockedCellKeys(world);

  const bk = buildBlueprintKind(toolId, inputShape);
  if (bk !== null) {
    for (const key of cellKeys) {
      const cell = parseCoordKey(key);
      if (!cell || !isInsideGrid(world.grid, cell)) continue;
      const r = safePlaceBlueprint(world, { buildingKind: bk, cell });
      if (r.ok) out.add(key);
    }
    return out;
  }

  if (toolId === "lumber") {
    for (const key of cellKeys) {
      if (blocked.has(key)) continue;
      if (findUnmarkedTreeCoveringCell(world, key)) out.add(key);
    }
    return out;
  }

  if (toolId === "haul") {
    for (const key of cellKeys) {
      if (blocked.has(key)) continue;
      if (findGroundResourceCoveringCell(world, key)) out.add(key);
    }
    return out;
  }

  if (toolId === "demolish") {
    for (const key of cellKeys) {
      if (findObstacleCoveringCell(world, key)) out.add(key);
    }
    return out;
  }

  if (toolId === "mine") {
    for (const key of cellKeys) {
      if (findUnmarkedStoneObstacleCoveringCell(world, key)) out.add(key);
    }
    return out;
  }

  for (const key of cellKeys) {
    if (blocked.has(key)) continue;
    out.add(key);
  }
  return out;
}
