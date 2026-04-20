/**
 * @file eat-job.ts
 * @description 进食工作的工厂函数。提供两种取食路径：
 *              - createEatJob：从地面物品取食（GoTo → PickUp → Wait）
 *              - createEatFromWarehouseJob：从仓库抽象库存取食（GoTo → TakeFromStorage → Wait）
 * @dependencies core/types — 基础类型与枚举；ai.types — Job 接口
 * @part-of AI 子系统 / 工作工厂（features/ai/jobs）
 */

import {
  ObjectId, CellCoord, DefId, ToilType, ToilState, JobState,
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
 * @param requestedCount - 本次计划吃掉的数量
 * @param nutritionGain  - 本次计划恢复的饱食度
 * @returns 包含三个 Toil 的进食 Job：
 *   1. GoTo   — 移动到食物位置
 *   2. PickUp — 拾取食物
 *   3. Wait   — 等待进食（60 tick），完成后恢复 40 点饱食度
 */
export function createEatJob(
  pawnId: ObjectId,
  foodId: ObjectId,
  foodCell: CellCoord,
  requestedCount: number,
  nutritionGain: number,
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
        localData: { requestedCount },
      },
      // 步骤3：等待进食（eating 标记触发饱食度恢复）
      {
        type: ToilType.Wait,
        state: ToilState.NotStarted,
        localData: { waited: 0, waitTicks: 60, eating: true, nutritionGain },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}

/**
 * 创建一个"从仓库取食物进食"工作（Job）。
 *
 * 配合 Task 3 之后的"仓库为正式存储唯一来源"约定使用：当地面无可用食物时，
 * eat 评估器会优先尝试从最近的仓库抽象库存中取食。
 *
 * @param pawnId            - 需要进食的 Pawn 的 ID
 * @param warehouseId       - 仓库建筑 ID
 * @param warehouseApproach - 仓库交互格坐标
 * @param defId             - 要从仓库提取的食物 defId
 * @param requestedCount    - 本次计划吃掉的数量（也是 TakeFromStorage 的请求量）
 * @param nutritionGain     - 本次计划恢复的饱食度
 * @returns 包含三个 Toil 的进食 Job：
 *   1. GoTo            — 移动到仓库交互格
 *   2. TakeFromStorage — 从仓库抽象库存取走指定 defId 的物品到手持栏
 *   3. Wait            — 等待进食（60 tick），完成后恢复 nutritionGain 饱食度
 */
export function createEatFromWarehouseJob(
  pawnId: ObjectId,
  warehouseId: ObjectId,
  warehouseApproach: CellCoord,
  defId: DefId,
  requestedCount: number,
  nutritionGain: number,
): Job {
  eatJobCounter++;
  return {
    id: `job_eat_${eatJobCounter}`,
    defId: 'job_eat',
    pawnId,
    targetId: warehouseId,
    targetCell: warehouseApproach,
    toils: [
      // 步骤1：移动到仓库交互格
      {
        type: ToilType.GoTo,
        targetCell: warehouseApproach,
        state: ToilState.NotStarted,
        localData: {},
      },
      // 步骤2：从仓库取食物（写入 pawn.inventory.carrying）
      {
        type: ToilType.TakeFromStorage,
        targetId: warehouseId,
        targetCell: warehouseApproach,
        state: ToilState.NotStarted,
        localData: { defId, count: requestedCount },
      },
      // 步骤3：等待进食（eating 标记触发饱食度恢复）
      {
        type: ToilType.Wait,
        state: ToilState.NotStarted,
        localData: { waited: 0, waitTicks: 60, eating: true, nutritionGain },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
