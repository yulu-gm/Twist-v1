/**
 * 将表现层网格配置同步为 {@link WorldCore} 可识别的实体（如石格障碍）。
 */

import { parseCoordKey } from "./world-grid";
import { spawnWorldEntity, type WorldCore } from "../world-core";

export function seedBlockedCellsAsObstacles(
  world: WorldCore,
  blockedKeys: ReadonlySet<string>
): WorldCore {
  let w = world;
  for (const key of blockedKeys) {
    const targetCell = parseCoordKey(key);
    if (!targetCell) continue;
    const spawned = spawnWorldEntity(w, {
      kind: "obstacle",
      cell: targetCell,
      occupiedCells: [targetCell],
      label: "stone"
    });
    if (spawned.outcome.kind === "created") {
      w = spawned.world;
    }
  }
  return w;
}
