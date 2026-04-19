/**
 * @file work-order.system.ts
 * @description 工作订单维护系统 — 每 tick 在 WORK_GENERATION 阶段对所有订单做一次 reconcile：
 *              1) 检查 item 目标是否仍存在（kind='object' 时若对象缺失/被销毁则置为 invalid）；
 *              2) 结果订单（sourceKind='result'）若全部 item 仍为 open（无执行者认领），
 *                 将这些 open item 标记为 blocked + blockedReason='no_executor'，
 *                 让看板能直观呈现"无人执行"的产出请求；
 *              3) 根据 item 状态分布推进订单整体状态（pending / active / done）。
 *              终态（done / cancelled）订单跳过；paused 订单跳过 item 检查但仍参与 done 推进。
 * @dependencies TickPhase — 核心枚举；SystemRegistration — 系统注册接口；World — 世界状态；
 *               WorkOrderItem, WorkOrderItemStatus — 订单领域类型
 * @part-of features/work-orders — 工作订单功能
 */

import { TickPhase } from '../../core/types';
import { SystemRegistration } from '../../core/tick-runner';
import type { World } from '../../world/world';
import type { WorkOrderItem, WorkOrderItemStatus } from './work-order.types';

/** Item 终态集合（done 与 invalid 后维护流程不再修改） */
const TERMINAL_ITEM_STATUSES: ReadonlySet<WorkOrderItemStatus> = new Set(['done', 'invalid']);

/**
 * 检查单个 item 的目标可用性 — 仅处理 kind='object' 类型，缺失或销毁则置为 invalid。
 * 其他 kind（cell/area/result_batch）由后续专门的 evaluator 处理，本函数留空。
 * @param item - 待检查的 item（会被原地修改）
 * @param map - 所在地图（用于查 objects 池）
 */
function reconcileItemTarget(item: WorkOrderItem, map: { objects: { get: (id: string) => any } }): void {
  if (TERMINAL_ITEM_STATUSES.has(item.status)) return;

  if (item.targetRef.kind === 'object' && item.targetRef.objectId) {
    const obj = map.objects.get(item.targetRef.objectId);
    if (!obj || obj.destroyed) {
      item.status = 'invalid';
      item.blockedReason = 'target_missing';
    }
  }
  // 其他 targetRef.kind（cell/area/result_batch）目前不在此推进 — 保留给后续 evaluator
}

/**
 * 维护所有地图的所有订单 — 见 @file 头部完整说明。
 * 暴露为独立函数便于测试直接调用而无需触发 tick runner。
 * @param world - 世界状态
 */
export function reconcileWorkOrders(world: World): void {
  for (const [, map] of world.maps) {
    const orders = map.workOrders.list();
    for (const order of orders) {
      // 终态订单不再处理
      if (order.status === 'cancelled' || order.status === 'done') continue;

      // 暂停订单跳过 item 级检查，但仍参与 done 推进（避免暂停期间永远卡住）
      if (order.status !== 'paused') {
        for (const it of order.items) {
          reconcileItemTarget(it, map);
        }
      }

      // 结果订单"无执行者"标记 — 若订单为 result 来源、未暂停、且全部 item 仍为 open，
      // 视为没有任何 pawn 接活，将这些 open item 置为 blocked + no_executor。
      // 必须在"全部终态 → done"判断之前执行，blocked 不属于终态，订单仍保持 pending，
      // 看板得以呈现"无执行者"的产出请求。
      // 注意：map 来源订单的同类失败由 Task 4 在 evaluator 中细化（不同类目原因不同）。
      if (
        order.sourceKind === 'result' &&
        order.status !== 'paused' &&
        order.items.length > 0 &&
        order.items.every(it => it.status === 'open')
      ) {
        for (const it of order.items) {
          it.status = 'blocked';
          it.blockedReason = 'no_executor';
        }
      }

      // 全部 item 都到终态 → 订单 done
      const allTerminal = order.items.length > 0 && order.items.every(it => TERMINAL_ITEM_STATUSES.has(it.status));
      // 注意：空 item 列表的订单（极端边界）也视为已完成 — 避免空订单永久挂起
      const noItems = order.items.length === 0;

      if (allTerminal || noItems) {
        order.status = 'done';
        continue;
      }

      // 未到终态 — 按 item 推进情况决定 active / pending（暂停状态保持不变）
      if (order.status === 'paused') continue;

      const hasInProgress = order.items.some(it => it.status === 'claimed' || it.status === 'working');
      order.status = hasInProgress ? 'active' : 'pending';
    }
  }
}

/** 工作订单维护系统注册：WORK_GENERATION 阶段每 tick 执行一次 */
export const workOrderSystem: SystemRegistration = {
  id: 'work_order_reconciler',
  phase: TickPhase.WORK_GENERATION,
  frequency: 1,
  execute: reconcileWorkOrders,
};
