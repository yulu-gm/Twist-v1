/**
 * @file drop.handler.ts
 * @description Drop Toil handler — Pawn 将携带的物品放置在当前格子
 * @part-of AI 子系统（features/ai/toil-handlers）
 */

import { CellCoord, ToilState, ZoneType, cellKey, parseKey } from '../../../core/types';
import { log } from '../../../core/logger';
import type { GameMap } from '../../../world/game-map';
import { createItemRaw } from '../../item/item.factory';
import { isCellCompatibleForItemDef } from '../../item/item.queries';
import type { ToilHandler } from './toil-handler.types';

/** 执行放置（Drop）Toil */
export const executeDrop: ToilHandler = ({ pawn, toil, map }) => {
  if (!pawn.inventory.carrying) {
    log.warn('ai', `Pawn ${pawn.id} has nothing to drop`, undefined, pawn.id);
    toil.state = ToilState.Failed;
    return;
  }

  // 从 localData 中获取物品定义 ID 和数量（由 PickUp 步骤填充）
  const defId = (toil.localData.defId as string) ?? 'unknown';
  const count = (toil.localData.count as number) ?? 1;

  const zone = map.zones.getZoneAt(cellKey(pawn.cell));
  const isStockpileCell = zone?.zoneType === ZoneType.Stockpile;
  if (isStockpileCell && !isCellCompatibleForItemDef(map, pawn.cell, defId)) {
    const fallbackCell = findAlternateStockpileCell(map, defId, pawn.cell);
    if (!fallbackCell) {
      log.warn('ai', `Pawn ${pawn.id} found incompatible stockpile cell for ${defId}`, undefined, pawn.id);
      toil.state = ToilState.Failed;
      return;
    }

    toil.targetCell = fallbackCell;
    pawn.movement.path = [];
    pawn.movement.pathIndex = 0;
    pawn.movement.moveProgress = 0;
    return;
  }

  const item = createItemRaw({
    defId, cell: pawn.cell, mapId: map.id, stackCount: count,
  });

  map.objects.add(item);
  pawn.inventory.carrying = null;

  log.debug('ai', `Pawn ${pawn.id} dropped ${defId} x${count} at (${pawn.cell.x},${pawn.cell.y})`, undefined, pawn.id);
  toil.state = ToilState.Completed;
};

function findAlternateStockpileCell(map: GameMap, defId: string, origin: CellCoord): CellCoord | null {
  let bestCell: CellCoord | null = null;
  let bestDistance = Infinity;

  for (const zone of map.zones.getAll()) {
    if (zone.zoneType !== ZoneType.Stockpile) continue;

    const stockpile = zone.config.stockpile;
    if (stockpile && !stockpile.allowAllHaulable && !stockpile.allowedDefIds.has(defId)) {
      continue;
    }

    for (const key of zone.cells) {
      const cell = parseKey(key);
      if (!map.pathGrid.isPassable(cell.x, cell.y)) continue;
      if (!map.spatial.isPassable(cell)) continue;
      if (!isCellCompatibleForItemDef(map, cell, defId)) continue;

      const distance = Math.abs(origin.x - cell.x) + Math.abs(origin.y - cell.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCell = cell;
      }
    }
  }

  return bestCell;
}
