/**
 * @file path.grid.ts
 * @description 寻路网格的重导出文件，将 PathGrid 从 game-map 模块导出供寻路功能使用
 * @dependencies world/game-map — PathGrid 类
 * @part-of features/pathfinding 寻路功能模块
 */

// 从 game-map 重导出 PathGrid
export { PathGrid } from '../../world/game-map';
