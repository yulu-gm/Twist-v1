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
  blueprintId?: ObjectId,
): Job {
  haulJobCounter++;

  // Final toil: Deliver to blueprint (with targetId) or Drop on ground
  const finalToil = blueprintId
    ? {
        type: ToilType.Deliver,
        targetId: blueprintId,
        targetCell: destCell,
        state: ToilState.NotStarted,
        localData: { defId: 'unknown', count: 1 }, // populated at runtime by PickUp
      }
    : {
        type: ToilType.Drop,
        targetCell: destCell,
        state: ToilState.NotStarted,
        localData: { defId: 'unknown', count: 1 }, // populated at runtime by PickUp
      };

  return {
    id: `job_haul_${haulJobCounter}`,
    defId: blueprintId ? 'job_deliver_materials' : 'job_haul',
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
      finalToil,
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
