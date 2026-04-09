/**
 * @file reservation.types.ts
 * @description 预约类型的重导出模块——从 world 层统一导出预约相关类型
 * @dependencies Reservation, ReservationTable — 来自 world/reservation-table
 * @part-of features/reservation — 资源预约功能
 */

// 从 world 层重导出预约接口
export type { Reservation } from '../../world/reservation-table';
// 从 world 层重导出预约表类
export { ReservationTable } from '../../world/reservation-table';
