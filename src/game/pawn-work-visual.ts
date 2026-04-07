/** 伐木/开采工单在小人表现层的可查询状态（与 Phaser 无关）。 */

import type { PawnState } from "./pawn-state";
import type { WorkRegistry } from "./work-system";
import type { GridCoord } from "./world-grid";
import { WORK_TYPE_FELLING, WORK_TYPE_MINING } from "./work-generation";

export type FellingOrMiningWorkTypePerform = typeof WORK_TYPE_FELLING | typeof WORK_TYPE_MINING;

export type ActiveFellingMiningPerform = Readonly<{
  workType: FellingOrMiningWorkTypePerform;
  targetCell: GridCoord;
}>;

export function activeFellingMiningPerformAtTarget(
  pawn: PawnState,
  workRegistry: WorkRegistry
): ActiveFellingMiningPerform | undefined {
  if (pawn.currentAction?.kind !== "perform-work") return undefined;
  const workId = pawn.currentAction.targetId ?? pawn.currentGoal?.workId;
  if (!workId) return undefined;
  const work = workRegistry.getWork(workId);
  if (!work || work.status !== "in_progress") return undefined;
  if (work.workType === WORK_TYPE_FELLING) {
    return { workType: WORK_TYPE_FELLING, targetCell: work.targetCell };
  }
  if (work.workType === WORK_TYPE_MINING) {
    return { workType: WORK_TYPE_MINING, targetCell: work.targetCell };
  }
  return undefined;
}
