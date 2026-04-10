/**
 * @file construct-job.ts
 * @description 建造工作的工厂函数。创建一个包含"前往工地 → 执行建造"两步的 Job。
 *              支持邻格站位：当提供 map 时，Pawn 会站在工地旁边而非工地上施工。
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

interface ConstructJobOptions {
  requiresPrepare?: boolean;
}

/** 建造工作计数器，用于生成唯一 Job ID */
let constructJobCounter = 0;

/**
 * 创建一个建造工作（Job）。
 *
 * @param pawnId   - 执行建造的 Pawn 的 ID
 * @param siteId   - 建筑工地（ConstructionSite）对象的 ID
 * @param siteCell - 建筑工地所在的格子坐标
 * @param map      - 可选的游戏地图，用于计算邻格站位
 * @returns 包含两个 Toil 的建造 Job：
 *   1. GoTo  — 移动到工地旁的可通行格子（若地图可用）或工地位置
 *   2. Work  — 在工地上执行建造（默认总工作量 100）
 */
export function createConstructJob(
  pawnId: ObjectId,
  siteId: ObjectId,
  siteCell: CellCoord,
  map?: GameMap,
  options: ConstructJobOptions = {},
): Job {
  constructJobCounter++;

  // 尝试邻格站位
  let gotoCell = siteCell;
  if (map) {
    const adj = findAdjacentPassable(siteCell, map);
    if (adj) gotoCell = adj;
  }

  return {
    id: `job_construct_${constructJobCounter}`,
    defId: 'job_construct',
    pawnId,
    targetId: siteId,
    targetCell: siteCell,
    toils: [
      // 步骤1：移动到建筑工地旁
      {
        type: ToilType.GoTo,
        targetCell: gotoCell,
        state: ToilState.NotStarted,
        localData: {},
      },
      ...(options.requiresPrepare
        ? [{
          type: ToilType.PrepareConstruction,
          targetId: siteId,
          targetCell: siteCell,
          state: ToilState.NotStarted,
          localData: {},
        }]
        : []),
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
