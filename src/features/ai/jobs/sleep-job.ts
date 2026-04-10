import {
  CellCoord, ObjectId, ToilType, ToilState, JobState,
} from '../../../core/types';
import type { Job } from '../ai.types';

let sleepJobCounter = 0;

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
