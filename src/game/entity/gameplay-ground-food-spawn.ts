/**
 * Gameplay 地面食物资源入世界时的统一草案：与 {@link createGameplayTreeDraft} 对称，
 * 场景载入、主世界播种、无头 hydrate 均应通过此工厂，避免种子字段分叉。
 */

import type { GridCoord } from "../map/world-grid";
import type { EntityDraft } from "../world-core-types";

export function createGameplayGroundFoodDraft(cell: GridCoord): EntityDraft {
  return {
    kind: "resource",
    cell,
    occupiedCells: [cell],
    materialKind: "food",
    containerKind: "ground",
    pickupAllowed: false
  };
}
