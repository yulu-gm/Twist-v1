/**
 * @file zone.types.ts
 * @description 区域类型的重导出模块——从核心模块和游戏地图模块统一导出区域相关类型
 * @dependencies Zone — 来自 world/game-map；ZoneType — 来自 core/types
 * @part-of features/zone — 区域管理功能
 */

// 从游戏地图模块重导出区域接口
export type { Zone } from '../../world/game-map';
// 从核心类型模块重导出区域类型枚举
export { ZoneType } from '../../core/types';
