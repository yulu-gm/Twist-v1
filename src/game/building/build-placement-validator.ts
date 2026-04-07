/**
 * 建造放置校验：边界、`blockedCellKeys` 与注册表内既有占格冲突。
 * 对齐 oh-code-design/建筑系统.yaml「建造校验器」与来自地图配置的空间合法性输入。
 */

import type { EntityRegistry } from "../entity/entity-registry";
import type { EntityId, GameEntity } from "../entity/entity-types";
import type { GridCoord, WorldGridConfig } from "../map/world-grid";
import { isInsideGrid, isWalkableCell } from "../map/world-grid";
import type { BuildingSpec } from "./building-spec-catalog";
import { resolveBlueprintCoveredCells } from "./blueprint-manager";

export type BuildPlacementRejectReason = "out-of-bounds" | "blocked-terrain" | "cell-occupied";

export type BuildPlacementValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: BuildPlacementRejectReason;
      cell: GridCoord;
      blockingEntityId?: EntityId;
    };

function entityBlocksBlueprintPlacement(entity: GameEntity): boolean {
  switch (entity.kind) {
    case "building":
    case "blueprint":
    case "tree":
    case "resource":
      return true;
    default:
      return false;
  }
}

export function validateBuildPlacementForBlueprint(
  registry: EntityRegistry,
  spec: BuildingSpec,
  anchor: GridCoord,
  gridConfig: WorldGridConfig
): BuildPlacementValidationResult {
  const cells = resolveBlueprintCoveredCells(anchor, spec);
  for (const cell of cells) {
    if (!isInsideGrid(gridConfig, cell)) {
      return { ok: false, reason: "out-of-bounds", cell: { ...cell } };
    }
    if (!isWalkableCell(gridConfig, cell)) {
      return { ok: false, reason: "blocked-terrain", cell: { ...cell } };
    }
    for (const e of registry.getByCell(cell)) {
      if (entityBlocksBlueprintPlacement(e)) {
        return {
          ok: false,
          reason: "cell-occupied",
          cell: { ...cell },
          blockingEntityId: e.id
        };
      }
    }
  }
  return { ok: true };
}
