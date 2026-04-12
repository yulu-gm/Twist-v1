/**
 * @file wander.evaluator.ts
 * @description 漫步工作评估器 — 作为最低优先级的 fallback 工作类别
 * @dependencies ai/work-evaluator.types — WorkEvaluator 接口；
 *               core/types — ToilType, ToilState, JobState, CellCoord
 * @part-of AI 子系统（features/ai）
 */

import type { WorkEvaluator } from '../work-evaluator.types';
import type { WorkEvaluation } from '../work-types';
import type { Pawn } from '../../pawn/pawn.types';
import type { GameMap } from '../../../world/game-map';
import type { World } from '../../../world/world';
import { ToilType, ToilState, JobState, CellCoord } from '../../../core/types';
import type { Job } from '../ai.types';

/** 漫步工作 ID 计数器 */
let wanderJobCounter = 0;

/**
 * 漫步工作评估器 — 当无其他生产性工作时随机走动
 *
 * 作为最终 evaluator 纳入列表，确保快照始终能解释实际被选中的工作。
 * 仅在 pawn 空闲超过 30 tick 时才生效。
 */
export const wanderWorkEvaluator: WorkEvaluator = {
  kind: 'wander',
  label: 'Wander',
  priority: 1,
  evaluate(pawn: Pawn, map: GameMap, world: World): WorkEvaluation {
    // 空闲不足 30 tick 时不触发漫步
    if (pawn.ai.idleTicks <= 30) {
      return {
        kind: 'wander',
        label: 'Wander',
        priority: 1,
        score: -1,
        failureReasonCode: 'need_not_triggered',
        failureReasonText: 'Not idle long enough',
        detail: null,
        jobDefId: null,
        evaluatedAtTick: world.tick,
        createJob: null,
      };
    }

    return {
      kind: 'wander',
      label: 'Wander',
      priority: 1,
      score: 0,
      failureReasonCode: 'none',
      failureReasonText: null,
      detail: null,
      jobDefId: 'job_wander',
      evaluatedAtTick: world.tick,
      createJob: () => createWanderJob(pawn, map, world),
    };
  },
};

/**
 * 创建一个随机漫步工作
 * 在 Pawn 周围半径 5 格内随机选择一个可通行格子作为目标，包含单个 GoTo Toil。
 * 最多尝试 10 次寻找有效目标。
 */
function createWanderJob(
  pawn: Pawn,
  map: GameMap,
  world: World,
): Job | null {
  const radius = 5;
  const attempts = 10;

  for (let i = 0; i < attempts; i++) {
    const dx = world.rng.nextInt(-radius, radius);
    const dy = world.rng.nextInt(-radius, radius);
    const target: CellCoord = {
      x: Math.max(0, Math.min(map.width - 1, pawn.cell.x + dx)),
      y: Math.max(0, Math.min(map.height - 1, pawn.cell.y + dy)),
    };

    if (!map.pathGrid.isPassable(target.x, target.y)) continue;
    if (!map.spatial.isPassable(target)) continue;

    wanderJobCounter++;
    return {
      id: `job_wander_${wanderJobCounter}`,
      defId: 'job_wander',
      pawnId: pawn.id,
      targetCell: target,
      toils: [
        {
          type: ToilType.GoTo,
          targetCell: target,
          state: ToilState.NotStarted,
          localData: {},
        },
      ],
      currentToilIndex: 0,
      reservations: [],
      state: JobState.Starting,
    };
  }

  return null;
}
