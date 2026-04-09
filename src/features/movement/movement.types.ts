/**
 * @file movement.types.ts
 * @description 移动系统类型定义，包括移动状态接口和默认移动参数
 * @dependencies core/types — CellCoord 格子坐标类型
 * @part-of features/movement 移动功能模块
 */

import { CellCoord } from '../../core/types';

/** 默认移动速度 — 每 tick 移动的格子比例 */
export const MOVE_SPEED_DEFAULT = 0.1;

/** 移动状态子对象（嵌套在 Pawn 内部） */
export interface MovementState {
  /** 当前移动路径（格子坐标数组） */
  path: CellCoord[];
  /** 当前路径中正在前往的节点索引 */
  pathIndex: number;
  /** 当前格子间的移动进度（0~1，达到1时移动到下一格） */
  moveProgress: number;
  /** 移动速度（每 tick 增加的进度量） */
  speed: number;
  /** 上一次移动前所在的格子（用于渲染插值），null 表示尚未移动过 */
  prevCell: CellCoord | null;
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
    prevCell: null,
  };
}
