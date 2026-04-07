/**
 * 将表现层网格配置同步为 {@link WorldCore} 可识别的实体（如石格障碍）。
 *
 * 位于 `game/` 编排层而非 `map/`，使地图子系统仅通过 {@link parseCoordKey} 等提供空间解析，
 * 与 `oh-code-design` 中「实体创建由编排/世界核入口驱动」的边界一致。
 *
 * 策略（与 {@link spawnWorldEntity} 的冲突/越界语义对齐）：
 * - **重复 key**：`blockedKeys` 为 `Set`，同一字符串只处理一次；若配置层误传多种字符串指向同一格，
 *   第二次创建会得到 `conflict`，非生产环境会打告警（见下方分支）。
 * - **非法 key**：`parseCoordKey` 失败（格式非法）时跳过该条，不修改 `world`；非生产环境 `console.warn`。
 */

import { parseCoordKey } from "./map/world-grid";
import { spawnWorldEntity, type WorldCore } from "./world-core";

export function seedBlockedCellsAsObstacles(
  world: WorldCore,
  blockedKeys: ReadonlySet<string>
): WorldCore {
  let w = world;
  for (const key of blockedKeys) {
    const targetCell = parseCoordKey(key);
    if (!targetCell) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[world-seed] skipped blocked cell key (unparseable): "${key}"`);
      }
      continue;
    }
    const spawned = spawnWorldEntity(w, {
      kind: "obstacle",
      cell: targetCell,
      occupiedCells: [targetCell],
      label: "stone"
    });
    if (spawned.outcome.kind === "created") {
      w = spawned.world;
    } else if (process.env.NODE_ENV !== "production") {
      const o = spawned.outcome;
      const detail =
        o.kind === "conflict"
          ? `conflict with ${o.blockingEntityId} at (${o.blockingCell.col},${o.blockingCell.row})`
          : o.kind === "invalid-draft"
            ? o.reason
            : `out of bounds at (${o.cell.col},${o.cell.row})`;
      console.warn(`[world-seed] blocked cell "${key}" did not spawn obstacle: ${detail}`);
    }
  }
  return w;
}
