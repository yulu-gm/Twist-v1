import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';

let carryJobCounter = 0;

interface CarryJobOptions {
  approachCell?: CellCoord;
  /** 仓库入库模式 — 提供 warehouseId 后最终步骤变成 StoreInStorage 而不是 Drop */
  warehouseId?: ObjectId;
}

/**
 * 创建携带物处理 Job
 *
 * 三种模式（按 options/参数选择）：
 * 1. 给定 blueprintId — 最终步骤是 Deliver，把携带物交付到蓝图
 * 2. 给定 options.warehouseId — 最终步骤是 StoreInStorage，把携带物写入仓库抽象库存
 * 3. 都不给定 — 最终步骤是 Drop（旧的就地落地路径，仅作 cleanup 兜底）
 */
export function createCarryJob(
  pawnId: ObjectId,
  destCell: CellCoord,
  count: number,
  blueprintId?: ObjectId,
  options: CarryJobOptions = {},
): Job {
  carryJobCounter++;
  const approachCell = options.approachCell ?? destCell;

  let finalToil;
  let defId: string;
  let targetId: ObjectId | undefined;

  if (blueprintId) {
    finalToil = {
      type: ToilType.Deliver,
      targetId: blueprintId,
      targetCell: approachCell,
      state: ToilState.NotStarted,
      localData: { defId: 'unknown', count },
    };
    defId = 'job_deliver_carried_materials';
    targetId = blueprintId;
  } else if (options.warehouseId) {
    finalToil = {
      type: ToilType.StoreInStorage,
      targetId: options.warehouseId,
      targetCell: approachCell,
      state: ToilState.NotStarted,
      localData: { count },
    };
    defId = 'job_store_carried_materials';
    targetId = options.warehouseId;
  } else {
    finalToil = {
      type: ToilType.Drop,
      targetCell: approachCell,
      state: ToilState.NotStarted,
      localData: { defId: 'unknown', count },
    };
    defId = 'job_store_carried_materials';
    targetId = undefined;
  }

  return {
    id: `job_carry_${carryJobCounter}`,
    defId,
    pawnId,
    targetId,
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
