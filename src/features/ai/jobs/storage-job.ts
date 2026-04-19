/**
 * @file storage-job.ts
 * @description 仓库相关 Job 工厂——生成"地面物资入仓"和"从仓库取材后交付目标"两类 Job
 * @dependencies core/types — ID/坐标/Toil/Job 枚举；ai.types — Job 接口
 * @part-of AI 子系统 / 工作工厂（features/ai/jobs）
 */

import {
  ObjectId,
  CellCoord,
  DefId,
  ToilType,
  ToilState,
  JobState,
} from '../../../core/types';
import { Job } from '../ai.types';

/** 仓库 Job 计数器，用于生成唯一 ID */
let storageJobCounter = 0;

/**
 * 创建"地面物资入仓"工作
 *
 * 4 个 Toil：
 * 1. GoTo  — 走到地面物品所在格
 * 2. PickUp — 拾取物品
 * 3. GoTo  — 走到仓库交互格
 * 4. StoreInStorage — 把携带物写入仓库抽象库存
 */
export function createStoreInStorageJob(
  pawnId: ObjectId,
  itemId: ObjectId,
  itemCell: CellCoord,
  warehouseId: ObjectId,
  approachCell: CellCoord,
  count: number,
): Job {
  storageJobCounter++;
  return {
    id: `job_store_in_storage_${storageJobCounter}`,
    defId: 'job_store_in_storage',
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
        localData: { requestedCount: count },
      },
      {
        type: ToilType.GoTo,
        targetCell: approachCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      {
        type: ToilType.StoreInStorage,
        targetId: warehouseId,
        targetCell: approachCell,
        state: ToilState.NotStarted,
        localData: { count },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}

/**
 * 创建"从仓库取材后交付蓝图"工作（Task 3 全量启用）
 *
 * 4 个 Toil：
 * 1. GoTo  — 走到仓库交互格
 * 2. TakeFromStorage — 从仓库提取一定数量某 defId 物资到手持栏
 * 3. GoTo  — 走到蓝图相邻格
 * 4. Deliver — 把携带物交付给蓝图
 */
export function createTakeFromStorageToBlueprintJob(
  pawnId: ObjectId,
  warehouseId: ObjectId,
  warehouseCell: CellCoord,
  defId: DefId,
  count: number,
  blueprintId: ObjectId,
  blueprintApproachCell: CellCoord,
): Job {
  storageJobCounter++;
  return {
    id: `job_take_from_storage_${storageJobCounter}`,
    defId: 'job_take_from_storage',
    pawnId,
    targetId: warehouseId,
    targetCell: warehouseCell,
    toils: [
      {
        type: ToilType.GoTo,
        targetCell: warehouseCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      {
        type: ToilType.TakeFromStorage,
        targetId: warehouseId,
        targetCell: warehouseCell,
        state: ToilState.NotStarted,
        localData: { defId, count },
      },
      {
        type: ToilType.GoTo,
        targetCell: blueprintApproachCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      {
        type: ToilType.Deliver,
        targetId: blueprintId,
        targetCell: blueprintApproachCell,
        state: ToilState.NotStarted,
        localData: { defId, count },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
