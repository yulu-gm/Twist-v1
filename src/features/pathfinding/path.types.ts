/**
 * @file path.types.ts
 * @description 寻路系统的类型定义，包括寻路选项和寻路结果接口
 * @dependencies core/types — CellCoord 格子坐标类型
 * @part-of features/pathfinding 寻路功能模块
 */

import { CellCoord } from '../../core/types';

/** 寻路选项配置 */
export interface PathOptions {
  /** 最大搜索节点数（超出后放弃搜索，默认 2000） */
  maxSearchNodes?: number;
  /** 是否避开危险区域 */
  avoidDanger?: boolean;
  /** 是否可以开门通过 */
  canOpenDoors?: boolean;
}

/** 寻路结果 */
export interface PathResult {
  /** 是否找到路径 */
  found: boolean;
  /** 路径上的格子坐标序列（从起点到终点） */
  path: CellCoord[];
  /** 路径的总移动代价 */
  cost: number;
}
