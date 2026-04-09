/**
 * @file cleanup.ts
 * @description 清理协议 —— 当 Pawn 的工作被中断或失败时，负责重置其状态。
 *              执行五个步骤：释放资源预留、丢弃携带物品、重置 AI 状态、清除移动路径、推送中断事件。
 * @dependencies core/types — ObjectId/ObjectKind/nextObjectId；core/logger — 日志；
 *               world — GameMap/World
 * @part-of AI 子系统（features/ai）
 */

import {
  ObjectId, ObjectKind,
} from '../../core/types';
import { log } from '../../core/logger';
import { GameMap } from '../../world/game-map';
import { World } from '../../world/world';
import { createItemRaw } from '../item/item.factory';

/**
 * 清理协议使用的 Pawn 鸭子类型接口。
 * 使用结构化接口而非具体 Pawn 类型，以解耦模块依赖。
 */
interface CleanablePawn {
  /** Pawn 唯一标识符 */
  id: ObjectId;
  /** 当前所在格子坐标 */
  cell: { x: number; y: number };

  // ── AI 状态 ──
  ai: {
    /** 当前正在执行的工作（可为 null） */
    currentJob: {
      /** 工作 ID */
      id: string;
      /** 此工作持有的资源预留 ID 列表 */
      reservations: string[];
      /** 劳作步骤列表 */
      toils: Array<{ localData: Record<string, unknown> }>;
      /** 当前 Toil 索引 */
      currentToilIndex: number;
    } | null;
    /** 当前 Toil 步骤索引 */
    currentToilIndex: number;
    /** Toil 执行的临时状态数据 */
    toilState: Record<string, unknown>;
    /** 空闲 Tick 计数 */
    idleTicks: number;
  };

  // ── 移动状态 ──
  movement: {
    /** 当前路径点序列 */
    path: { x: number; y: number }[];
    /** 路径中当前步进索引 */
    pathIndex: number;
    /** 移动进度 */
    moveProgress: number;
    /** 移动速度 */
    speed: number;
    /** 上一次移动前所在的格子 */
    prevCell: { x: number; y: number } | null;
  };

  // ── 背包 ──
  inventory: {
    /** 当前携带的物品 ID */
    carrying: ObjectId | null;
    /** 最大负重容量 */
    carryCapacity: number;
  };
}

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
  pawn: CleanablePawn,
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
    const droppedItem = createItemRaw({
      defId, cell: pawn.cell, mapId: map.id, stackCount: count,
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
