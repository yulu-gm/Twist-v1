/**
 * 任务标记格筛选：与领域层「哪些格会实际接到工单」对齐，避免空地板铺满标记。
 */

import type { BuildingKind } from "../game/entity/entity-types";
import { safePlaceBlueprint, type WorldCore } from "../game/world-core";
import { isInsideGrid, parseCoordKey } from "../game/map";
import {
  mergedBlockedCellKeys,
  resolveToolbarTaskTargetCellKeys
} from "../game/interaction/toolbar-task-target-resolution";

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
    return resolveToolbarTaskTargetCellKeys(world, world, "lumber", cellKeys);
  }

  if (toolId === "haul") {
    return resolveToolbarTaskTargetCellKeys(world, world, "haul", cellKeys);
  }

  if (toolId === "demolish") {
    return resolveToolbarTaskTargetCellKeys(world, world, "demolish", cellKeys);
  }

  if (toolId === "mine") {
    return resolveToolbarTaskTargetCellKeys(world, world, "mine", cellKeys);
  }

  const blocked = mergedBlockedCellKeys(world);
  for (const key of cellKeys) {
    if (blocked.has(key)) continue;
    out.add(key);
  }
  return out;
}
