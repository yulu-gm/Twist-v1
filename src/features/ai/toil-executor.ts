/**
 * @file toil-executor.ts
 * @description Toil 执行器系统 — 状态机调度器，将每个 Toil 分发到对应的 handler。
 *              具体 handler 实现在 toil-handlers/ 目录下，工作生命周期在 job-lifecycle.ts 中。
 * @part-of AI 子系统（features/ai）
 */

import {
  ObjectKind, TickPhase, ToilType, ToilState, JobState,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import { cleanupProtocol } from './cleanup';
import { advanceToil, completeJob } from './job-lifecycle';
import type { ToilHandler } from './toil-handlers/toil-handler.types';
import { executeGoTo } from './toil-handlers/goto.handler';
import { executePickUp } from './toil-handlers/pickup.handler';
import { executeDrop } from './toil-handlers/drop.handler';
import { executeWork } from './toil-handlers/work.handler';
import { executeWait } from './toil-handlers/wait.handler';
import { executeDeliver } from './toil-handlers/deliver.handler';
import { executeInteract } from './toil-handlers/interact.handler';

/** Toil 类型 → handler 注册表 */
const toilHandlers: Record<string, ToilHandler> = {
  [ToilType.GoTo]: executeGoTo,
  [ToilType.PickUp]: executePickUp,
  [ToilType.Drop]: executeDrop,
  [ToilType.Work]: executeWork,
  [ToilType.Wait]: executeWait,
  [ToilType.Deliver]: executeDeliver,
  [ToilType.Interact]: executeInteract,
};

/**
 * Toil 执行器系统注册。
 * 在 EXECUTION 阶段运行，每 Tick 处理所有地图上的 Pawn 工作步骤。
 */
export const toilExecutorSystem: SystemRegistration = {
  id: 'toilExecutor',
  phase: TickPhase.EXECUTION,
  frequency: 1,
  execute(world: World) {
    for (const [, map] of world.maps) {
      processMap(world, map);
    }
  },
};

/**
 * 处理单个地图上所有 Pawn 的 Toil 执行逻辑。
 * 遍历所有 Pawn，对有工作的 Pawn 执行当前 Toil，并处理中断条件。
 */
function processMap(world: World, map: GameMap): void {
  const pawns = map.objects.allOfKind(ObjectKind.Pawn);

  for (const pawn of pawns) {
    const job = pawn.ai.currentJob;
    if (!job) continue;
    if (job.state === JobState.Done || job.state === JobState.Failed) continue;

    // ── 中途中断检测 ──
    // 紧急需求：饱食度低于 10 时中断当前非进食工作
    if (pawn.needs.food < 10 && job.defId !== 'job_eat') {
      log.info('ai', `Pawn ${pawn.id} interrupted (food critical: ${Math.floor(pawn.needs.food)})`, undefined, pawn.id);
      cleanupProtocol(pawn, map, world);
      continue;
    }

    // 目标被摧毁检测
    if (job.targetId) {
      const target = map.objects.get(job.targetId);
      if (target && target.destroyed) {
        log.info('ai', `Pawn ${pawn.id} interrupted (target ${job.targetId} destroyed)`, undefined, pawn.id);
        cleanupProtocol(pawn, map, world);
        continue;
      }
    }

    // 将工作标记为活跃状态
    if (job.state === JobState.Starting) {
      job.state = JobState.Active;
    }

    const toilIndex = job.currentToilIndex;
    if (toilIndex >= job.toils.length) {
      // 所有 Toil 步骤已完成
      completeJob(pawn, map, world);
      continue;
    }

    const toil = job.toils[toilIndex];

    if (toil.state === ToilState.NotStarted) {
      toil.state = ToilState.InProgress;
    }

    if (toil.state === ToilState.Completed) {
      advanceToil(pawn, job, map, world);
      continue;
    }

    if (toil.state === ToilState.Failed) {
      log.warn('ai', `Toil failed for pawn ${pawn.id}, triggering cleanup`, undefined, pawn.id);
      cleanupProtocol(pawn, map, world);
      continue;
    }

    // 查找并执行对应的 handler
    const handler = toilHandlers[toil.type];
    if (handler) {
      handler({ pawn, toil, job, map, world });
    } else {
      log.warn('ai', `Unknown toil type: ${toil.type}`, undefined, pawn.id);
      toil.state = ToilState.Failed;
    }
  }
}
