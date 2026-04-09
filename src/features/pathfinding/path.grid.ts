/**
 * @file path.grid.ts
 * @description 寻路网格的重导出文件，将 PathGrid 从 world 层导出供寻路功能使用
 * @dependencies world/path-grid — PathGrid 类
 * @part-of features/pathfinding 寻路功能模块
 */

// 从 world 层重导出 PathGrid
export { PathGrid } from '../../world/path-grid';
