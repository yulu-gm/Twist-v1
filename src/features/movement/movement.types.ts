/**
 * @file movement.types.ts
 * @description 移动系统类型定义，包括移动状态接口和默认移动参数
 * @dependencies core/types — CellCoord 格子坐标类型
 * @part-of features/movement 移动功能模块
 */

import { CellCoord } from '../../core/types';

/**
 * 走完一格所需的进度累计值（整数刻度）。
 * moveProgress、speed 均以此为单位，避免慢速（远低于每 tick 走满一格）时依赖极小浮点数。
 */
export const MOVE_PROGRESS_PER_CELL = 100;

/** 默认移动速度 — 每 tick 增加的进度（同 MOVE_PROGRESS_PER_CELL 刻度，10 即约 10 tick 走一格） */
export const MOVE_SPEED_DEFAULT = 10;

/** 移动状态子对象（嵌套在 Pawn 内部） */
export interface MovementState {
  /** 当前移动路径（格子坐标数组） */
  path: CellCoord[];
  /** 当前路径中正在前往的节点索引 */
  pathIndex: number;
  /** 当前格子间的移动进度（0 ~ MOVE_PROGRESS_PER_CELL-1，达到 MOVE_PROGRESS_PER_CELL 时进下一格并清零） */
  moveProgress: number;
  /** 移动速度（每 tick 增加的进度量，与 MOVE_PROGRESS_PER_CELL 同刻度） */
  speed: number;
}

/**
 * 创建默认的移动状态对象
 * @returns 初始化的移动状态（空路径、默认速度）
 */
export function createDefaultMovement(): MovementState {
  return {
    path: [],
    pathIndex: 0,
    moveProgress: 0,
    speed: MOVE_SPEED_DEFAULT,
  };
}
