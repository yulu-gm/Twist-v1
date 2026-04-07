import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';

let harvestJobCounter = 0;

export function createHarvestJob(
  pawnId: ObjectId,
  targetId: ObjectId,
  targetCell: CellCoord,
): Job {
  harvestJobCounter++;
  return {
    id: `job_harvest_${harvestJobCounter}`,
    defId: 'job_harvest',
    pawnId,
    targetId,
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
        targetId,
        targetCell,
        state: ToilState.NotStarted,
        localData: { workDone: 0, totalWork: 60 },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
