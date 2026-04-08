/**
 * @file reservation.table.ts
 * @description 预约清理系统——每 tick 扫描所有地图，释放已过期的资源预约
 * @dependencies TickPhase — 核心类型；SystemRegistration — tick系统注册接口；World — 世界状态
 * @part-of features/reservation — 资源预约功能
 */

import { TickPhase } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import { World } from '../../world/world';

/**
 * 预约清理执行函数
 * @param world - 世界状态对象
 * 操作：遍历所有地图，调用预约表的 cleanupExpired 方法，
 *       释放所有到期 tick 已到的预约，确保资源不会被永久锁定
 */
function reservationCleanupExecute(world: World): void {
  for (const [, map] of world.maps) {
    map.reservations.cleanupExpired(world.tick);
  }
}

/** 预约清理系统注册：在 CLEANUP 阶段每 tick 执行，释放过期预约 */
export const reservationCleanupSystem: SystemRegistration = {
  id: 'reservationCleanup',
  phase: TickPhase.CLEANUP,
  frequency: 1,
  execute: reservationCleanupExecute,
};
