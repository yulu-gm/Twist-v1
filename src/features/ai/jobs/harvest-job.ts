/**
 * @file harvest-job.ts
 * @description 收割工作的工厂函数。创建一个包含"前往目标 → 执行收割"两步的 Job。
 *              支持邻格站位：当提供 map 时，Pawn 会站在目标旁边而非目标上收割。
 * @dependencies core/types — 基础类型与枚举；ai.types — Job 接口；
 *               adjacent-util — 邻格查找；world/game-map — 地图数据
 * @part-of AI 子系统 / 工作工厂（features/ai/jobs）
 */

import {
  ObjectId, CellCoord, ToilType, ToilState, JobState,
} from '../../../core/types';
import { Job } from '../ai.types';
import type { GameMap } from '../../../world/game-map';
import { findAdjacentPassable } from './adjacent-util';

/** 收割工作计数器，用于生成唯一 Job ID */
let harvestJobCounter = 0;

/**
 * 创建一个收割工作（Job）。
 *
 * @param pawnId     - 执行收割的 Pawn 的 ID
 * @param targetId   - 收割指派（Designation）对象的 ID
 * @param targetCell - 收割目标所在的格子坐标
 * @param map        - 可选的游戏地图，用于计算邻格站位
 * @returns 包含两个 Toil 的收割 Job：
 *   1. GoTo — 移动到目标旁的可通行格子（若地图可用）或目标位置
 *   2. Work — 执行收割操作（默认总工作量 60）
 */
export function createHarvestJob(
  pawnId: ObjectId,
  targetId: ObjectId,
  targetCell: CellCoord,
  map?: GameMap,
): Job {
  harvestJobCounter++;

  // 尝试邻格站位
  let gotoCell = targetCell;
  if (map) {
    const adj = findAdjacentPassable(targetCell, map);
    if (adj) gotoCell = adj;
  }

  return {
    id: `job_harvest_${harvestJobCounter}`,
    defId: 'job_harvest',
    pawnId,
    targetId,
    targetCell,
    toils: [
      // 步骤1：移动到收割目标旁
      {
        type: ToilType.GoTo,
        targetCell: gotoCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      // 步骤2：执行收割工作
      {
        type: ToilType.Work,
        targetId,
        targetCell,
        state: ToilState.NotStarted,
        localData: { workDone: 0, totalWork: 60 },
      },
    ],
    currentToilIndex: 0,
    reservations: [],
    state: JobState.Starting,
  };
}
