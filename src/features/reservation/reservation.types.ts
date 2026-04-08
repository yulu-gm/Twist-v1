/**
 * @file reservation.types.ts
 * @description 预约类型的重导出模块——从游戏地图模块统一导出预约相关类型
 * @dependencies Reservation, ReservationTable — 来自 world/game-map
 * @part-of features/reservation — 资源预约功能
 */

// 从游戏地图模块重导出预约接口
export type { Reservation } from '../../world/game-map';
// 从游戏地图模块重导出预约表类
export { ReservationTable } from '../../world/game-map';
