/**
 * Gameplay 树入世界时的统一草案：渲染格、占格与领域认树（`occupiedCells`）一致。
 * 场景载入、主世界播种、无头 hydrate 均应通过此工厂，避免分叉。
 */

import type { GridCoord } from "../map/world-grid";
import type { EntityDraft } from "../world-core-types";

export function createGameplayTreeDraft(cell: GridCoord, label?: string): EntityDraft {
  const base: EntityDraft = {
    kind: "tree",
    cell,
    occupiedCells: [cell],
    loggingMarked: false
  };
  return label === undefined ? base : { ...base, label };
}
