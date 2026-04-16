/**
 * @file movement.types.ts
 * @description 移动系统类型定义
 * @part-of features/movement 移动功能模块
 */

/**
 * 走完一格所需的进度累计值（整数刻度）。
 * moveProgress、speed 均以此为单位，避免慢速（远低于每 tick 走满一格）时依赖极小浮点数。
 */
export const MOVE_PROGRESS_PER_CELL = 100;
