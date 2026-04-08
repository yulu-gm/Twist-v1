/**
 * @file haul-job.ts
 * @description 搬运工作的工厂函数。创建一个包含"前往物品 → 拾取 → 前往目的地 → 投放/交付"四步的 Job。
 *              支持两种模式：向蓝图交付材料（Deliver）和普通地面放置（Drop）。
 * @dependencies core/types — 基础类型与枚举；ai.types — Job 接口
 * @part-of AI 子系统 / 工作工厂（features/ai/jobs）
 */

import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';

/** 搬运工作计数器，用于生成唯一 Job ID */
let haulJobCounter = 0;

/**
 * 创建一个搬运工作（Job）。
 *
 * @param pawnId      - 执行搬运的 Pawn 的 ID
 * @param itemId      - 要搬运的物品对象 ID
 * @param itemCell    - 物品当前所在的格子坐标
 * @param destCell    - 搬运目的地的格子坐标
 * @param blueprintId - 可选，目标蓝图 ID。若提供则使用 Deliver 交付材料，否则使用 Drop 放置地面
 * @returns 包含四个 Toil 的搬运 Job：
 *   1. GoTo   — 移动到物品位置
 *   2. PickUp — 拾取物品
 *   3. GoTo   — 移动到目的地
 *   4. Deliver/Drop — 向蓝图交付材料 或 放置到地面
 */
export function createHaulJob(
  pawnId: ObjectId,
  itemId: ObjectId,
  itemCell: CellCoord,
  destCell: CellCoord,
  blueprintId?: ObjectId,
): Job {
  haulJobCounter++;

  // 最终步骤：根据是否有蓝图 ID 决定使用 Deliver（交付）还是 Drop（放置）
  const finalToil = blueprintId
    ? {
        type: ToilType.Deliver,
        targetId: blueprintId,
        targetCell: destCell,
        state: ToilState.NotStarted,
        localData: { defId: 'unknown', count: 1 }, // 运行时由 PickUp 步骤填充实际值
      }
    : {
        type: ToilType.Drop,
        targetCell: destCell,
        state: ToilState.NotStarted,
        localData: { defId: 'unknown', count: 1 }, // 运行时由 PickUp 步骤填充实际值
      };

  return {
    id: `job_haul_${haulJobCounter}`,
    defId: blueprintId ? 'job_deliver_materials' : 'job_haul',
    pawnId,
    targetId: itemId,
    targetCell: itemCell,
    toils: [
      // 步骤1：移动到物品位置
      {
        type: ToilType.GoTo,
        targetCell: itemCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      // 步骤2：拾取物品
      {
        type: ToilType.PickUp,
        targetId: itemId,
        targetCell: itemCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      // 步骤3：移动到目的地
      {
        type: ToilType.GoTo,
        targetCell: destCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      // 步骤4：交付/放置
      finalToil,
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
