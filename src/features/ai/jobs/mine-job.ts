import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';

let mineJobCounter = 0;

export function createMineJob(
  pawnId: ObjectId,
  targetCell: CellCoord,
  designationId: ObjectId,
): Job {
  mineJobCounter++;
  return {
    id: `job_mine_${mineJobCounter}`,
    defId: 'job_mine',
    pawnId,
    targetId: designationId,
    targetCell,
    toils: [
      {
        type: ToilType.GoTo,
        targetCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      {
        type: ToilType.Work,
        targetCell,
        targetId: designationId,
        state: ToilState.NotStarted,
        localData: { workDone: 0, totalWork: 100 },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
