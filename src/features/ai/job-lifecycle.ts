/**
 * @file job-lifecycle.ts
 * @description 工作生命周期管理 — Toil 步骤推进和工作完成处理
 * @part-of AI 子系统（features/ai）
 */

import { JobState } from '../../core/types';
import { log } from '../../core/logger';
import type { Pawn } from '../pawn/pawn.types';
import type { Job } from './ai.types';
import type { GameMap } from '../../world/game-map';
import type { World } from '../../world/world';

/**
 * 推进到下一个 Toil 步骤。若所有步骤已完成则完成整个工作。
 */
export function advanceToil(pawn: Pawn, job: Job, world: World): void {
  job.currentToilIndex++;
  pawn.ai.currentToilIndex = job.currentToilIndex;

  if (job.currentToilIndex >= job.toils.length) {
    completeJob(pawn, null, world);
  }
}

/**
 * 完成工作：标记工作为完成状态，释放所有预留，重置 Pawn 的 AI 和移动状态。
 */
export function completeJob(pawn: Pawn, map: GameMap | null, world: World): void {
  const job = pawn.ai.currentJob;
  if (!job) return;

  job.state = JobState.Done;

  // 释放此工作持有的所有资源预留
  if (map) {
    for (const resId of job.reservations) {
      map.reservations.release(resId);
    }
  }

  log.info('ai', `Pawn ${pawn.id} completed job ${job.id} (${job.defId})`, undefined, pawn.id);

  world.eventBuffer.push({
    type: 'job_completed',
    tick: world.tick,
    data: { pawnId: pawn.id, jobId: job.id, defId: job.defId },
  });

  // 重置 Pawn 的 AI 状态和移动状态
  pawn.ai.currentJob = null;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};
  pawn.movement.path = [];
  pawn.movement.pathIndex = 0;
  pawn.movement.moveProgress = 0;
}
