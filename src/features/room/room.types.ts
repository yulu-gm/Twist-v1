/**
 * @file room.types.ts
 * @description 房间类型的重导出模块——从游戏地图模块统一导出房间接口
 * @dependencies Room — 来自 world/game-map
 * @part-of features/room — 房间管理功能
 */

// 从游戏地图模块重导出房间接口
export type { Room } from '../../world/game-map';
