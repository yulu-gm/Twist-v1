/**
 * @file job-selector.ts
 * @description 工作选择系统 —— 每 Tick 为空闲的 Pawn 选择最优工作。
 *              通过 evaluator 管线收集各类别的工作评估结果，
 *              按优先级和分数排序并尝试预留目标，选出最佳工作分配给 Pawn。
 *              将排序后的结果冻结为决策快照供 inspector 展示。
 * @dependencies core/types — 基础类型与枚举；core/tick-runner — 系统注册；core/logger — 日志；
 *               world — World/GameMap；
 *               ai.types — Job；
 *               work-evaluators — 统一评估器管线；work-types — 决策快照类型
 * @part-of AI 子系统（features/ai）
 */

import {
  ObjectKind, TickPhase, ToilType,
} from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { log } from '../../core/logger';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import { Job } from './ai.types';
import type { Pawn } from '../pawn/pawn.types';
import type { WorkEvaluation, WorkOption, WorkFailureReasonCode } from './work-types';
import { workEvaluators } from './work-evaluators';

/**
 * 工作选择系统注册。
 * 在 AI_DECISION 阶段运行，每 Tick 为所有空闲 Pawn 选择并分配工作。
 */
export const jobSelectionSystem: SystemRegistration = {
  id: 'jobSelection',
  phase: TickPhase.AI_DECISION,
  frequency: 1,
  execute(world: World) {
    for (const [, map] of world.maps) {
      processMap(world, map);
    }
  },
};

/**
 * 处理单个地图上所有 Pawn 的工作选择。
 * 仅为空闲（无当前工作）的 Pawn 分配新工作。
 *
 * @param world - 游戏世界实例
 * @param map   - 当前处理的地图
 */
function processMap(world: World, map: GameMap): void {
  const pawns = map.objects.allOfKind(ObjectKind.Pawn);

  for (const pawn of pawns) {
    if (pawn.drafted) continue;

    // 仅为空闲的 Pawn 分配工作
    if (pawn.ai.currentJob !== null) continue;

    pawn.ai.idleTicks++;

    // ── 1. 运行 evaluator 管线收集评估结果 ──
    const evaluations: WorkEvaluation[] = [];
    for (const evaluator of workEvaluators) {
      evaluations.push(evaluator.evaluate(pawn, map, world));
    }

    // ── 2. 按 priority 降序、score 降序排列 ──
    evaluations.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.score - a.score;
    });

    // ── 3. 从高到低尝试分配，记录 blocked/deferred ──
    let assigned = false;
    let selectedKind: string | null = null;
    const overrides = new Map<string, { code: WorkFailureReasonCode; text: string }>();

    for (const evaluation of evaluations) {
      // 跳过不可用的评估（无 createJob 表示该类别当前无有效选项）
      if (!evaluation.createJob) continue;

      const job = evaluation.createJob();
      if (!job) continue;

      // 检查携带冲突
      if (isJobBlockedByCarriedItems(pawn, job)) {
        overrides.set(evaluation.kind, {
          code: 'carrying_conflict',
          text: '当前携带物会阻塞需拾取的工作',
        });
        continue;
      }

      // 尝试预留目标
      if (job.targetId) {
        const resId = map.reservations.tryReserve({
          claimantId: pawn.id,
          targetId: job.targetId,
          jobId: job.id,
          currentTick: world.tick,
        });

        if (resId === null) {
          overrides.set(evaluation.kind, {
            code: 'target_reserved',
            text: '目标已被预留',
          });
          continue;
        }

        job.reservations.push(resId);
      }

      assignJob(pawn, job, map, world);
      selectedKind = evaluation.kind;
      assigned = true;
      break;
    }

    // ── 4. 冻结决策快照 ──
    freezeWorkDecision(pawn, evaluations, selectedKind, overrides, world.tick);
  }
}

/**
 * 冻结工作决策快照 — 将排序后的评估结果持久化到 pawn.ai.workDecision
 *
 * @param pawn         - 执行选工的 Pawn
 * @param evaluations  - 排序后的评估结果列表（不可变，不应被修改）
 * @param selectedKind - 被选中的工作类别 kind（null 表示无工作可分配）
 * @param overrides    - 分配过程中发现的阻塞覆盖（携带冲突、预留失败等）
 * @param worldTick    - 当前世界 tick
 */
function freezeWorkDecision(
  pawn: Pawn,
  evaluations: readonly WorkEvaluation[],
  selectedKind: string | null,
  overrides: ReadonlyMap<string, { code: WorkFailureReasonCode; text: string }>,
  worldTick: number,
): void {
  const currentToil = pawn.ai.currentJob?.toils[pawn.ai.currentJob.currentToilIndex];

  // 标记状态：被选中的为 active，失败的为 blocked，其余为 deferred
  let foundSelected = false;
  const options: WorkOption[] = evaluations.map((evaluation) => {
    const override = overrides.get(evaluation.kind);
    const reasonCode = override?.code ?? evaluation.failureReasonCode;
    const reasonText = override?.text ?? evaluation.failureReasonText;
    const hasJob = !override && evaluation.createJob != null;

    let status: WorkOption['status'];
    if (evaluation.kind === selectedKind) {
      status = 'active';
      foundSelected = true;
    } else if (reasonCode !== 'none') {
      status = 'blocked';
    } else if (foundSelected || selectedKind !== null) {
      // 在已选工作之后，或有已选工作但不是当前项
      status = 'deferred';
    } else {
      // 没有任何工作被选中时，无 createJob 的标记为 blocked
      status = hasJob ? 'deferred' : 'blocked';
    }

    return {
      kind: evaluation.kind,
      label: evaluation.label,
      priority: evaluation.priority,
      score: evaluation.score,
      failureReasonCode: reasonCode,
      failureReasonText: reasonText,
      detail: evaluation.detail,
      jobDefId: evaluation.jobDefId,
      evaluatedAtTick: worldTick,
      status,
    };
  });

  pawn.ai.workDecision = {
    evaluatedAtTick: worldTick,
    selectedWorkKind: selectedKind,
    selectedWorkLabel: options.find(o => o.kind === selectedKind)?.label ?? null,
    selectedJobId: pawn.ai.currentJob?.id ?? null,
    activeToilLabel: currentToil?.type ?? null,
    activeToilState: currentToil?.state ?? null,
    options,
  };
}

/** 检查工作是否因携带物而被阻塞（携带物品时不能执行含 PickUp 的工作） */
function isJobBlockedByCarriedItems(pawn: Pawn, job: Job): boolean {
  return pawn.inventory.carrying != null
    && job.toils.some(toil => toil.type === ToilType.PickUp);
}

/**
 * 将工作分配给 Pawn：设置 AI 状态、重置空闲计数、推送 job_assigned 事件。
 *
 * @param pawn   - 接受工作的 Pawn
 * @param job    - 要分配的工作
 * @param map    - 当前地图
 * @param world  - 游戏世界实例
 */
function assignJob(
  pawn: Pawn,
  job: Job,
  map: GameMap,
  world: World,
): void {
  pawn.ai.currentJob = job;
  pawn.ai.currentToilIndex = 0;
  pawn.ai.toilState = {};
  pawn.ai.idleTicks = 0;

  log.info('ai', `Pawn ${pawn.id} assigned job ${job.id} (${job.defId})`, undefined, pawn.id);

  world.eventBuffer.push({
    type: 'job_assigned',
    tick: world.tick,
    data: { pawnId: pawn.id, jobId: job.id, defId: job.defId },
  });
}
