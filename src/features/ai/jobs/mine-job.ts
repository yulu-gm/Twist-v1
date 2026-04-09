/**
 * @file mine-job.ts
 * @description 采矿工作的工厂函数。创建一个包含"前往矿点 → 执行采矿"两步的 Job。
 *              由于矿石格子本身不可通行，Pawn 需要站在相邻的可通行格子上进行采矿。
 * @dependencies core/types — 基础类型与枚举；ai.types — Job 接口；
 *               adjacent-util — 邻格查找；world/game-map — 地图数据
 * @part-of AI 子系统 / 工作工厂（features/ai/jobs）
 */

import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';
import { GameMap } from '../../../world/game-map';
import { findAdjacentPassable } from './adjacent-util';

/** 采矿工作计数器，用于生成唯一 Job ID */
let mineJobCounter = 0;

/**
 * 创建一个采矿工作（Job）。
 *
 * @param pawnId        - 执行采矿的 Pawn 的 ID
 * @param targetCell    - 矿石所在的格子坐标
 * @param designationId - 采矿指派（Designation）对象的 ID
 * @param map           - 可选的游戏地图，用于计算 Pawn 站位（相邻可通行格子）
 * @returns 包含两个 Toil 的采矿 Job：
 *   1. GoTo — 移动到矿石旁的可通行格子（若地图可用）或矿石格子本身
 *   2. Work — 执行采矿操作（默认总工作量 100）
 */
export function createMineJob(
  pawnId: ObjectId,
  targetCell: CellCoord,
  designationId: ObjectId,
  map?: GameMap,
): Job {
  mineJobCounter++;

  // 矿石格子不可通行——Pawn 必须站在相邻的可通行格子上
  let gotoCell = targetCell;
  if (map) {
    const adj = findAdjacentPassable(targetCell, map);
    if (adj) gotoCell = adj;
  }

  return {
    id: `job_mine_${mineJobCounter}`,
    defId: 'job_mine',
    pawnId,
    targetId: designationId,
    targetCell,
    toils: [
      // 步骤1：移动到矿石旁的可通行位置
      {
        type: ToilType.GoTo,
        targetCell: gotoCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      // 步骤2：执行采矿工作
      {
        type: ToilType.Work,
        targetCell,
        targetId: designationId,
        state: ToilState.NotStarted,
        localData: { workDone: 0, totalWork: 100 },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
