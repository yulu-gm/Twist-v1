/**
 * @file construct-job.ts
 * @description 建造工作的工厂函数。创建一个包含"前往工地 → 执行建造"两步的 Job。
 * @dependencies core/types — 基础类型与枚举；ai.types — Job 接口
 * @part-of AI 子系统 / 工作工厂（features/ai/jobs）
 */

import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';

/** 建造工作计数器，用于生成唯一 Job ID */
let constructJobCounter = 0;

/**
 * 创建一个建造工作（Job）。
 *
 * @param pawnId   - 执行建造的 Pawn 的 ID
 * @param siteId   - 建筑工地（ConstructionSite）对象的 ID
 * @param siteCell - 建筑工地所在的格子坐标
 * @returns 包含两个 Toil 的建造 Job：
 *   1. GoTo  — 移动到工地位置
 *   2. Work  — 在工地上执行建造（默认总工作量 100）
 */
export function createConstructJob(
  pawnId: ObjectId,
  siteId: ObjectId,
  siteCell: CellCoord,
): Job {
  constructJobCounter++;
  return {
    id: `job_construct_${constructJobCounter}`,
    defId: 'job_construct',
    pawnId,
    targetId: siteId,
    targetCell: siteCell,
    toils: [
      // 步骤1：移动到建筑工地
      {
        type: ToilType.GoTo,
        targetCell: siteCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      // 步骤2：执行建造工作
      {
        type: ToilType.Work,
        targetId: siteId,
        targetCell: siteCell,
        state: ToilState.NotStarted,
        localData: { workDone: 0, totalWork: 100 },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
