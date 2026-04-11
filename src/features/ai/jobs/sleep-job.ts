/**
 * @file sleep-job.ts
 * @description 睡眠工作工厂函数 — 创建有床位目标或就地休息的睡眠 Job
 * @dependencies core/types, features/ai/ai.types
 * @part-of features/ai — AI 子系统
 */

import {
  CellCoord, ObjectId, ToilType, ToilState, JobState,
} from '../../../core/types';
import type { Job } from '../ai.types';

/** 睡眠工作 ID 计数器，用于生成唯一 Job ID */
let sleepJobCounter = 0;

/** 创建睡眠工作 — 有床位时前往床位并在床上休息，否则就地休息 */
export function createSleepJob(
  pawnId: ObjectId,
  target: { bedId: ObjectId; interactionCell: CellCoord } | null,
  currentCell: CellCoord,
): Job {
  sleepJobCounter++;

  if (target) {
    return {
      id: `job_sleep_${sleepJobCounter}`,
      defId: 'job_sleep',
      pawnId,
      targetId: target.bedId,
      targetCell: target.interactionCell,
      toils: [
        {
          type: ToilType.GoTo,
          targetCell: target.interactionCell,
          state: ToilState.NotStarted,
          localData: {},
        },
        {
          type: ToilType.Wait,
          targetId: target.bedId,
          targetCell: target.interactionCell,
          state: ToilState.NotStarted,
          localData: {
            waited: 0,
            sleeping: true,
            bedId: target.bedId,
          },
        },
      ],
      currentToilIndex: 0,
      reservations: [],
      state: JobState.Starting,
    };
  }

  return {
    id: `job_sleep_${sleepJobCounter}`,
    defId: 'job_sleep',
    pawnId,
    targetCell: currentCell,
    toils: [
      {
        type: ToilType.Wait,
        targetCell: currentCell,
        state: ToilState.NotStarted,
        localData: {
          waited: 0,
          sleeping: true,
          onFloor: true,
        },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
