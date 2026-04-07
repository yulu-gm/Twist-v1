import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';

let haulJobCounter = 0;

export function createHaulJob(
  pawnId: ObjectId,
  itemId: ObjectId,
  itemCell: CellCoord,
  destCell: CellCoord,
): Job {
  haulJobCounter++;
  return {
    id: `job_haul_${haulJobCounter}`,
    defId: 'job_haul',
    pawnId,
    targetId: itemId,
    targetCell: itemCell,
    toils: [
      {
        type: ToilType.GoTo,
        targetCell: itemCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      {
        type: ToilType.PickUp,
        targetId: itemId,
        targetCell: itemCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      {
        type: ToilType.GoTo,
        targetCell: destCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      {
        type: ToilType.Drop,
        targetCell: destCell,
        state: ToilState.NotStarted,
        localData: { defId: 'unknown', count: 1 }, // will be populated at runtime
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
