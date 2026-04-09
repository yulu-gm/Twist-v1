/**
 * @file room.types.ts
 * @description 房间类型的重导出模块——从 world 层统一导出房间接口
 * @dependencies Room — 来自 world/room-graph
 * @part-of features/room — 房间管理功能
 */

// 从 world 层重导出房间接口
export type { Room } from '../../world/room-graph';
