/**
 * @file hauling.evaluator.ts
 * @description 存储区搬运工作评估器 — 评估 pawn 是否可以搬运散落物品到存储区
 * @dependencies ai/work-evaluator.types — WorkEvaluator 接口；
 *               pathfinding — 距离估算和可达性检查；
 *               item/item.queries — 存储格查找和容量检查；
 *               ai/jobs — 搬运工作工厂函数
 * @part-of AI 子系统（features/ai）
 */

import type { WorkEvaluator } from '../work-evaluator.types';
import type { WorkEvaluation } from '../work-types';
import type { Pawn } from '../../pawn/pawn.types';
import type { Item } from '../../item/item.types';
import type { GameMap } from '../../../world/game-map';
import type { World } from '../../../world/world';
import type { Zone } from '../../../world/zone-manager';
import { ObjectKind, ZoneType, CellCoord, cellKey } from '../../../core/types';
import { estimateDistance, isReachable } from '../../pathfinding/path.service';
import {
  findNearestAcceptingCell,
  getCellAvailableCapacity,
  isCellCompatibleForItemDef,
} from '../../item/item.queries';
import { createHaulJob } from '../jobs/haul-job';

/**
 * 存储区搬运工作评估器 — 为散落物品寻找存储区目标
 *
 * 仅处理带 haulable 标签且不在兼容存储区内的物品
 * 评分公式：15 - itemDist * 0.45 - destDist * 0.2
 */
export const haulToStockpileWorkEvaluator: WorkEvaluator = {
  kind: 'haul_to_stockpile',
  label: 'Haul To Stockpile',
  priority: 15,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    const blocked = (code: 'no_target' | 'no_stockpile_destination', text: string): WorkEvaluation => ({
      kind: 'haul_to_stockpile',
      label: 'Haul To Stockpile',
      priority: 15,
      score: -1,
      failureReasonCode: code,
      failureReasonText: text,
      detail: null,
      jobDefId: null,
      evaluatedAtTick: world.tick,
      createJob: null,
    });

    const items = map.objects.allOfKind(ObjectKind.Item) as Item[];
    let bestItem: Item | null = null;
    let bestDest: CellCoord | null = null;
    let bestScore = -Infinity;

    for (const item of items) {
      if (item.destroyed) continue;
      if (!item.tags.has('haulable')) continue;
      if (map.reservations.isReserved(item.id)) continue;
      if (isItemInCompatibleStockpile(map, item)) continue;

      const placement = findReachableStockpilePlacement(pawn, item, map, world);
      if (!placement) continue;

      const haulCount = Math.min(item.stackCount, placement.totalCapacity, pawn.inventory.carryCapacity);
      if (haulCount <= 0) continue;

      const itemDist = estimateDistance(pawn.cell, item.cell);
      const destDist = estimateDistance(item.cell, placement.bestCell);
      const score = 15 - itemDist * 0.45 - destDist * 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
        bestDest = placement.bestCell;
      }
    }

    if (!bestItem || !bestDest) {
      return blocked('no_target', 'No haulable items outside stockpiles');
    }

    // 重新计算最终的可搬运数量
    const finalPlacement = findReachableStockpilePlacement(pawn, bestItem, map, world);
    if (!finalPlacement) {
      return blocked('no_stockpile_destination', 'No reachable stockpile destination');
    }

    const haulCount = Math.min(bestItem.stackCount, finalPlacement.totalCapacity, pawn.inventory.carryCapacity);
    if (haulCount <= 0) {
      return blocked('no_stockpile_destination', 'No reachable stockpile destination');
    }

    // 捕获闭包变量
    const itemId = bestItem.id;
    const itemCell = { ...bestItem.cell };
    const destCell = { ...bestDest };

    return {
      kind: 'haul_to_stockpile',
      label: 'Haul To Stockpile',
      priority: 15,
      score: bestScore,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: bestItem.defId,
      jobDefId: 'job_haul',
      evaluatedAtTick: world.tick,
      createJob: () => createHaulJob(pawn.id, itemId, itemCell, destCell, haulCount),
    };
  },
};

/** 判断物品是否已经位于兼容的 stockpile 存储区内 */
function isItemInCompatibleStockpile(map: GameMap, item: Item): boolean {
  const zone = map.zones.getZoneAt(cellKey(item.cell));
  return !!zone
    && zone.zoneType === ZoneType.Stockpile
    && isItemAcceptedByStockpile(zone, item)
    && isCellCompatibleForItemDef(map, item.cell, item.defId);
}

/** 检查存储区是否接受该物品 */
function isItemAcceptedByStockpile(zone: Zone, item: Item): boolean {
  const stockpile = zone.config.stockpile;
  if (!stockpile) return true;
  if (stockpile.allowAllHaulable) return item.tags.has('haulable');
  return stockpile.allowedDefIds.has(item.defId);
}

/** 查找可达的存储区放置位置 */
function findReachableStockpilePlacement(
  pawn: Pawn,
  item: Item,
  map: GameMap,
  world: World,
): { bestCell: CellCoord; totalCapacity: number } | null {
  if (!isReachable(map, pawn.cell, item.cell)) return null;

  let totalReachableCapacity = 0;
  for (const zone of map.zones.getAll()) {
    if (zone.zoneType !== ZoneType.Stockpile) continue;
    for (const key of zone.cells) {
      const [x, y] = key.split(',').map(Number);
      const cell = { x, y };
      if (!isReachable(map, item.cell, cell)) continue;
      totalReachableCapacity += getCellAvailableCapacity(map, world.defs, cell, item.defId, 'stockpile-only');
    }
  }

  if (totalReachableCapacity <= 0) return null;

  const excludedCells = new Set<string>();
  while (true) {
    const candidate = findNearestAcceptingCell(
      map,
      world.defs,
      item.cell,
      item.defId,
      'stockpile-only',
      {
        excludedCells,
        selectionPreference: 'prefer-existing-stacks',
      },
    );
    if (!candidate) return null;
    if (isReachable(map, item.cell, candidate)) {
      return {
        bestCell: candidate,
        totalCapacity: totalReachableCapacity,
      };
    }
    excludedCells.add(cellKey(candidate));
  }
}
