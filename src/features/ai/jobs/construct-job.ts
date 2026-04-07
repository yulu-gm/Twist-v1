import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';

let constructJobCounter = 0;

export function createConstructJob(
  pawnId: ObjectId,
  siteId: ObjectId,
  siteCell: CellCoord,
): Job {
  constructJobCounter++;
  return {
    id: `job_construct_${constructJobCounter}`,
    defId: 'job_construct',
    pawnId,
    targetId: siteId,
    targetCell: siteCell,
    toils: [
      {
        type: ToilType.GoTo,
        targetCell: siteCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      {
        type: ToilType.Work,
        targetId: siteId,
        targetCell: siteCell,
        state: ToilState.NotStarted,
        localData: { workDone: 0, totalWork: 100 },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
