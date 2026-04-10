/**
 * @file cleanup.ts
 * @description 清理协议 —— 当 Pawn 的工作被中断或失败时，负责重置其状态。
 *              执行五个步骤：释放资源预留、丢弃携带物品、重置 AI 状态、清除移动路径、推送中断事件。
 * @dependencies core/types — ObjectId/ObjectKind/nextObjectId；core/logger — 日志；
 *               world — GameMap/World
 * @part-of AI 子系统（features/ai）
 */

import {
  CellCoord, ObjectId, ObjectKind, ZoneType, cellKey,
} from '../../core/types';
import { log } from '../../core/logger';
import { GameMap } from '../../world/game-map';
import { World } from '../../world/world';
import { createItemRaw } from '../item/item.factory';
import { isCellCompatibleForItemDef } from '../item/item.queries';
import type { Pawn } from '../pawn/pawn.types';

/**
 * 清理协议 —— 在工作中断或失败后重置 Pawn 的状态。
 *
 * 执行以下五个步骤：
 *   1. 释放当前工作的所有资源预留
 *   2. 若 Pawn 正在携带物品，将其丢弃到当前格子
 *   3. 重置 pawn.ai（currentJob=null, currentToilIndex=0, toilState={}）
 *   4. 清除 pawn.movement.path
 *   5. 推送 job_interrupted 事件
 *
 * @param pawn  - 需要清理的 Pawn
 * @param map   - Pawn 所在的地图
 * @param world - 游戏世界实例
 */
export function cleanupProtocol(
  pawn: Pawn,
  map: GameMap,
  world: World,
): void {
  const job = pawn.ai.currentJob;

  // 步骤1：释放此工作的所有资源预留
  if (job) {
    for (const resId of job.reservations) {
      map.reservations.release(resId);
    }
    // 额外释放此 Pawn 名下所有未被追踪的预留
    map.reservations.releaseAllByPawn(pawn.id);
  }

  // 步骤2：若正在携带物品，丢弃到当前格子
  if (pawn.inventory.carrying) {
    const carriedId = pawn.inventory.carrying;
    pawn.inventory.carrying = null;

    // 尝试从当前工作的 Toil localData 中恢复物品信息
    let defId = 'unknown';
    let count = 1;
    if (job) {
      for (const toil of job.toils) {
        if (toil.localData.pickedDefId) {
          defId = toil.localData.pickedDefId as string;
          count = (toil.localData.pickedCount as number) ?? 1;
          break;
        }
        if (toil.localData.defId) {
          defId = toil.localData.defId as string;
          count = (toil.localData.count as number) ?? 1;
          break;
        }
      }
    }

    // 在地面重新创建物品对象
    const dropCell = findSafeDropCell(map, pawn.cell, defId) ?? pawn.cell;
    const droppedItem = createItemRaw({
      defId, cell: dropCell, mapId: map.id, stackCount: count,
    });
    map.objects.add(droppedItem);

    log.debug('ai', `Pawn ${pawn.id} dropped ${defId} x${count} during cleanup`, undefined, pawn.id);
  }

  // 步骤3：重置 Pawn 的 AI 状态
  const jobId = job?.id ?? 'unknown';
  pawn.ai.currentJob = null;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};

  // 步骤4：清除移动路径
  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;

  // 步骤5：推送工作中断事件
  world.eventBuffer.push({
    type: 'job_interrupted',
    tick: world.tick,
    data: {
      pawnId: pawn.id,
      jobId,
    },
  });

  log.info('ai', `Cleanup protocol executed for pawn ${pawn.id}, job ${jobId}`, undefined, pawn.id);
}

function findSafeDropCell(map: GameMap, origin: CellCoord, defId: string): CellCoord | null {
  if (canDropItemAt(map, origin, defId)) {
    return origin;
  }

  let bestCell: CellCoord | null = null;
  let bestDistance = Infinity;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const cell = { x, y };
      if (!canDropItemAt(map, cell, defId)) continue;

      const distance = Math.abs(origin.x - x) + Math.abs(origin.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCell = cell;
      }
    }
  }

  return bestCell;
}

function canDropItemAt(map: GameMap, cell: CellCoord, defId: string): boolean {
  if (!map.pathGrid.isPassable(cell.x, cell.y)) return false;
  if (!map.spatial.isPassable(cell)) return false;
  if (!isCellCompatibleForItemDef(map, cell, defId)) return false;

  const zone = map.zones.getZoneAt(cellKey(cell));
  if (!zone || zone.zoneType !== ZoneType.Stockpile) return true;

  const stockpile = zone.config.stockpile;
  if (!stockpile) return true;
  if (stockpile.allowAllHaulable) return true;
  return stockpile.allowedDefIds.has(defId);
}
