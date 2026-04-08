/**
 * @file eat-job.ts
 * @description 进食工作的工厂函数。创建一个包含"前往食物 → 拾取食物 → 等待进食"三步的 Job。
 * @dependencies core/types — 基础类型与枚举；ai.types — Job 接口
 * @part-of AI 子系统 / 工作工厂（features/ai/jobs）
 */

import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';

/** 进食工作计数器，用于生成唯一 Job ID */
let eatJobCounter = 0;

/**
 * 创建一个进食工作（Job）。
 *
 * @param pawnId   - 需要进食的 Pawn 的 ID
 * @param foodId   - 食物物品对象的 ID
 * @param foodCell - 食物所在的格子坐标
 * @returns 包含三个 Toil 的进食 Job：
 *   1. GoTo   — 移动到食物位置
 *   2. PickUp — 拾取食物
 *   3. Wait   — 等待进食（60 tick），完成后恢复 40 点饱食度
 */
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
      // 步骤1：移动到食物位置
      {
        type: ToilType.GoTo,
        targetCell: foodCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      // 步骤2：拾取食物
      {
        type: ToilType.PickUp,
        targetId: foodId,
        targetCell: foodCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      // 步骤3：等待进食（eating 标记触发饱食度恢复）
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
