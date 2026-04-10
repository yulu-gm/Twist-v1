/**
 * @file cleanup.ts
 * @description 清理协议 —— 当 Pawn 的工作被中断或失败时，负责重置其状态。
 *              执行五个步骤：释放资源预留、丢弃携带物品、重置 AI 状态、清除移动路径、推送中断事件。
 * @dependencies core/types — ObjectId/ObjectKind/nextObjectId；core/logger — 日志；
 *               world — GameMap/World
 * @part-of AI 子系统（features/ai）
 */

import { log } from '../../core/logger';
import { GameMap } from '../../world/game-map';
import { World } from '../../world/world';
import { placeItemOnMap } from '../item/item.placement';
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
 * @param reason - 可选中断原因，供调用方保留上下文
 */
export function cleanupProtocol(
  pawn: Pawn,
  map: GameMap,
  world: World,
  reason?: string,
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
    const carrying = pawn.inventory.carrying;
    const result = placeItemOnMap({
      map,
      defs: world.defs,
      defId: carrying.defId,
      count: carrying.count,
      preferredCell: pawn.cell,
      searchScope: 'nearest-compatible',
      noCapacityPolicy: 'force-overflow',
    });

    if (!result.success || result.remainingCount > 0) {
      log.warn('ai', `Cleanup drop for pawn ${pawn.id} had remainder for ${carrying.defId}`, {
        placedCount: result.placedCount,
        remainingCount: result.remainingCount,
        usedFallback: result.usedFallback,
        usedCells: result.usedCells,
      }, pawn.id);
    }

    if (result.remainingCount <= 0) {
      pawn.inventory.carrying = null;
    } else {
      pawn.inventory.carrying = {
        defId: carrying.defId,
        count: result.remainingCount,
      };
    }
    const actualCell = result.usedCells[0] ?? pawn.cell;
    log.debug(
      'ai',
      `Pawn ${pawn.id} dropped ${carrying.defId} x${result.placedCount} during cleanup at (${actualCell.x},${actualCell.y}) (fallback=${result.usedFallback})`,
      undefined,
      pawn.id,
    );
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
      ...(reason ? { reason } : {}),
    },
  });

  log.info('ai', `Cleanup protocol executed for pawn ${pawn.id}, job ${jobId}`, undefined, pawn.id);
}
