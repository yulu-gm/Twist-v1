/**
 * @file reservation.cleanup.ts
 * @description Reservation 兜底清理辅助逻辑。
 */

import type { GameMap } from '../../world/game-map';

/**
 * 释放所有目标对象已缺失或已销毁的 reservation。
 */
export function releaseMissingTargetReservations(map: GameMap): void {
  for (const res of map.reservations.getAll()) {
    const obj = map.objects.get(res.targetId);
    if (!obj || obj.destroyed) {
      map.reservations.release(res.id);
    }
  }
}
