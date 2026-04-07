import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';

let eatJobCounter = 0;

export function createEatJob(
  pawnId: ObjectId,
  foodId: ObjectId,
  foodCell: CellCoord,
): Job {
  eatJobCounter++;
  return {
    id: `job_eat_${eatJobCounter}`,
    defId: 'job_eat',
    pawnId,
    targetId: foodId,
    targetCell: foodCell,
    toils: [
      {
        type: ToilType.GoTo,
        targetCell: foodCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      {
        type: ToilType.PickUp,
        targetId: foodId,
        targetCell: foodCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      {
        type: ToilType.Wait,
        state: ToilState.NotStarted,
        localData: { waited: 0, waitTicks: 60, eating: true, nutritionValue: 40 },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
