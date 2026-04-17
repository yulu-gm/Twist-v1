/**
 * @file work-order.commands.ts
 * @description 工作订单命令处理器集合 — 包括订单创建（地图来源 / 结果来源）、暂停、恢复、取消、
 *              重排序、偏好 pawn 指派等命令。所有命令必须显式携带 mapId（不做地图自动解析）。
 * @dependencies CommandHandler, Command, ValidationResult, ExecutionResult — 命令总线接口；
 *               World — 世界状态；GameMap — 游戏地图；
 *               WorkOrderItem, CreateWorkOrderItemInput — 订单领域类型
 * @part-of features/work-orders — 工作订单功能
 */

import {
  CommandHandler,
  Command,
  ValidationResult,
  ExecutionResult,
} from '../../core/command-bus';
import { World } from '../../world/world';
import { GameMap } from '../../world/game-map';
import {
  CreateWorkOrderItemInput,
  WorkOrderItem,
  WorkOrderItemStatus,
} from './work-order.types';

// ── 辅助函数 ──

/**
 * 严格按 payload.mapId 解析地图（不做默认地图回退）
 * @param world - 世界状态
 * @param cmd - 命令对象
 * @returns 对应的 GameMap；未找到返回 undefined
 */
function getMap(world: World, cmd: Command): GameMap | undefined {
  const mapId = cmd.payload.mapId as string | undefined;
  if (!mapId) return undefined;
  return world.maps.get(mapId);
}

/** Item 终态集合（done/invalid 不再被维护流程修改） */
const TERMINAL_ITEM_STATUSES: ReadonlySet<WorkOrderItemStatus> = new Set(['done', 'invalid']);

// ── create_map_work_order（创建地图来源订单） ──

/**
 * 创建地图来源工作订单 —
 * 验证：mapId 存在、items 数组提供（可空？通常应至少 1 项，但本层不强制以利于测试）
 * 执行：调用 map.workOrders.createMapOrder，发出 work_order_created 事件
 */
export const createMapWorkOrderHandler: CommandHandler = {
  type: 'create_map_work_order',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    if (!cmd.payload.mapId) return { valid: false, reason: 'mapId is required' };
    const map = getMap(w, cmd);
    if (!map) return { valid: false, reason: `Map ${cmd.payload.mapId} not found` };
    if (!cmd.payload.orderKind) return { valid: false, reason: 'orderKind is required' };
    if (!Array.isArray(cmd.payload.items)) return { valid: false, reason: 'items must be an array' };
    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const map = getMap(w, cmd)!;
    const order = map.workOrders.createMapOrder({
      orderKind: cmd.payload.orderKind as string,
      title: (cmd.payload.title as string) ?? '',
      items: cmd.payload.items as CreateWorkOrderItemInput[],
      priorityIndex: cmd.payload.priorityIndex as number | undefined,
      preferredPawnIds: cmd.payload.preferredPawnIds as string[] | undefined,
      createdAtTick: w.tick,
    });

    return {
      events: [{
        type: 'work_order_created',
        tick: w.tick,
        data: {
          orderId: order.id,
          sourceKind: 'map',
          orderKind: order.orderKind,
          itemCount: order.items.length,
        },
      }],
    };
  },
};

// ── create_result_work_order（创建结果来源订单） ──

/**
 * 创建结果来源（工作台产出）工作订单 — 字段同 create_map_work_order，
 * 仅 sourceKind 不同，事件 data.sourceKind='result'
 */
export const createResultWorkOrderHandler: CommandHandler = {
  type: 'create_result_work_order',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    if (!cmd.payload.mapId) return { valid: false, reason: 'mapId is required' };
    const map = getMap(w, cmd);
    if (!map) return { valid: false, reason: `Map ${cmd.payload.mapId} not found` };
    if (!cmd.payload.orderKind) return { valid: false, reason: 'orderKind is required' };
    if (!Array.isArray(cmd.payload.items)) return { valid: false, reason: 'items must be an array' };
    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const map = getMap(w, cmd)!;
    const order = map.workOrders.createResultOrder({
      orderKind: cmd.payload.orderKind as string,
      title: (cmd.payload.title as string) ?? '',
      items: cmd.payload.items as CreateWorkOrderItemInput[],
      priorityIndex: cmd.payload.priorityIndex as number | undefined,
      preferredPawnIds: cmd.payload.preferredPawnIds as string[] | undefined,
      createdAtTick: w.tick,
    });

    return {
      events: [{
        type: 'work_order_created',
        tick: w.tick,
        data: {
          orderId: order.id,
          sourceKind: 'result',
          orderKind: order.orderKind,
          itemCount: order.items.length,
        },
      }],
    };
  },
};

// ── pause_work_order（暂停订单） ──

/**
 * 暂停订单 — 状态变更为 'paused'。
 * 验证：mapId/orderId 存在、订单当前不在终态（done/cancelled）
 */
export const pauseWorkOrderHandler: CommandHandler = {
  type: 'pause_work_order',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = getMap(w, cmd);
    if (!map) return { valid: false, reason: `Map ${cmd.payload.mapId} not found` };
    const orderId = cmd.payload.orderId as string;
    if (!orderId) return { valid: false, reason: 'orderId is required' };
    const order = map.workOrders.get(orderId);
    if (!order) return { valid: false, reason: `Order ${orderId} not found` };
    if (order.status === 'done' || order.status === 'cancelled') {
      return { valid: false, reason: `Order ${orderId} already in terminal state ${order.status}` };
    }
    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const map = getMap(w, cmd)!;
    const orderId = cmd.payload.orderId as string;
    const order = map.workOrders.get(orderId)!;
    order.status = 'paused';
    return {
      events: [{
        type: 'work_order_paused',
        tick: w.tick,
        data: { orderId },
      }],
    };
  },
};

// ── resume_work_order（恢复订单） ──

/**
 * 恢复订单 — 状态从 'paused' 回到 'pending'。
 * 维护系统会在下一次 tick 根据 item 推进状态决定是否升为 'active'。
 */
export const resumeWorkOrderHandler: CommandHandler = {
  type: 'resume_work_order',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = getMap(w, cmd);
    if (!map) return { valid: false, reason: `Map ${cmd.payload.mapId} not found` };
    const orderId = cmd.payload.orderId as string;
    if (!orderId) return { valid: false, reason: 'orderId is required' };
    const order = map.workOrders.get(orderId);
    if (!order) return { valid: false, reason: `Order ${orderId} not found` };
    if (order.status !== 'paused') {
      return { valid: false, reason: `Order ${orderId} is not paused (current: ${order.status})` };
    }
    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const map = getMap(w, cmd)!;
    const orderId = cmd.payload.orderId as string;
    const order = map.workOrders.get(orderId)!;
    order.status = 'pending';
    return {
      events: [{
        type: 'work_order_resumed',
        tick: w.tick,
        data: { orderId },
      }],
    };
  },
};

// ── cancel_work_order（取消订单） ──

/**
 * 取消订单 — 订单状态置为 'cancelled'，所有未到终态的 item 标记为 'invalid'，
 * blockedReason='order_cancelled'。AI 在安全的原子步骤处感知并退出工作。
 */
export const cancelWorkOrderHandler: CommandHandler = {
  type: 'cancel_work_order',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = getMap(w, cmd);
    if (!map) return { valid: false, reason: `Map ${cmd.payload.mapId} not found` };
    const orderId = cmd.payload.orderId as string;
    if (!orderId) return { valid: false, reason: 'orderId is required' };
    const order = map.workOrders.get(orderId);
    if (!order) return { valid: false, reason: `Order ${orderId} not found` };
    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const map = getMap(w, cmd)!;
    const orderId = cmd.payload.orderId as string;
    const order = map.workOrders.get(orderId)!;
    order.status = 'cancelled';
    // 把所有未到终态的 item 翻转为 invalid，原因记录为 order_cancelled
    for (const it of order.items as WorkOrderItem[]) {
      if (!TERMINAL_ITEM_STATUSES.has(it.status)) {
        it.status = 'invalid';
        it.blockedReason = 'order_cancelled';
      }
    }
    return {
      events: [{
        type: 'work_order_cancelled',
        tick: w.tick,
        data: { orderId },
      }],
    };
  },
};

// ── reorder_work_orders（重排订单优先级） ──

/**
 * 重排订单 — 按 payload.orderIds 顺序重新分配 priorityIndex。
 * 未在传入列表中的订单保持原相对顺序追加在末尾。
 */
export const reorderWorkOrdersHandler: CommandHandler = {
  type: 'reorder_work_orders',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = getMap(w, cmd);
    if (!map) return { valid: false, reason: `Map ${cmd.payload.mapId} not found` };
    if (!Array.isArray(cmd.payload.orderIds)) return { valid: false, reason: 'orderIds must be an array' };
    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const map = getMap(w, cmd)!;
    const orderIds = cmd.payload.orderIds as string[];
    map.workOrders.reorder(orderIds);
    return {
      events: [{
        type: 'work_order_reordered',
        tick: w.tick,
        data: { mapId: map.id, orderIds },
      }],
    };
  },
};

// ── assign_preferred_pawn（添加 / 移除偏好 pawn） ──

/**
 * 偏好 pawn 指派 — mode='add'（默认）将 pawn 加入 preferredPawnIds（去重）；
 * mode='remove' 将 pawn 从列表中移除。
 */
export const assignPreferredPawnHandler: CommandHandler = {
  type: 'assign_preferred_pawn',

  validate(world: any, cmd: Command): ValidationResult {
    const w = world as World;
    const map = getMap(w, cmd);
    if (!map) return { valid: false, reason: `Map ${cmd.payload.mapId} not found` };
    const orderId = cmd.payload.orderId as string;
    if (!orderId) return { valid: false, reason: 'orderId is required' };
    const order = map.workOrders.get(orderId);
    if (!order) return { valid: false, reason: `Order ${orderId} not found` };
    if (!cmd.payload.pawnId) return { valid: false, reason: 'pawnId is required' };
    return { valid: true };
  },

  execute(world: any, cmd: Command): ExecutionResult {
    const w = world as World;
    const map = getMap(w, cmd)!;
    const orderId = cmd.payload.orderId as string;
    const order = map.workOrders.get(orderId)!;
    const pawnId = cmd.payload.pawnId as string;
    const mode = (cmd.payload.mode as 'add' | 'remove' | undefined) ?? 'add';

    if (mode === 'remove') {
      order.preferredPawnIds = order.preferredPawnIds.filter(id => id !== pawnId);
    } else {
      // add：去重
      if (!order.preferredPawnIds.includes(pawnId)) {
        order.preferredPawnIds.push(pawnId);
      }
    }
    return {
      events: [{
        type: 'work_order_assignment_changed',
        tick: w.tick,
        data: { orderId, pawnId, mode },
      }],
    };
  },
};

/** 所有工作订单命令处理器数组，用于批量注册到命令总线 */
export const workOrderCommandHandlers: CommandHandler[] = [
  createMapWorkOrderHandler,
  createResultWorkOrderHandler,
  pauseWorkOrderHandler,
  resumeWorkOrderHandler,
  cancelWorkOrderHandler,
  reorderWorkOrdersHandler,
  assignPreferredPawnHandler,
];
