import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';

let carryJobCounter = 0;

interface CarryJobOptions {
  approachCell?: CellCoord;
}

export function createCarryJob(
  pawnId: ObjectId,
  destCell: CellCoord,
  count: number,
  blueprintId?: ObjectId,
  options: CarryJobOptions = {},
): Job {
  carryJobCounter++;
  const approachCell = options.approachCell ?? destCell;

  const finalToil = blueprintId
    ? {
        type: ToilType.Deliver,
        targetId: blueprintId,
        targetCell: approachCell,
        state: ToilState.NotStarted,
        localData: { defId: 'unknown', count },
      }
    : {
        type: ToilType.Drop,
        targetCell: approachCell,
        state: ToilState.NotStarted,
        localData: { defId: 'unknown', count },
      };

  return {
    id: `job_carry_${carryJobCounter}`,
    defId: blueprintId ? 'job_deliver_carried_materials' : 'job_store_carried_materials',
    pawnId,
    targetId: blueprintId,
    targetCell: destCell,
    toils: [
      {
        type: ToilType.GoTo,
        targetCell: approachCell,
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
