/**
 * @file work-order.types.ts
 * @description 工作订单（WorkOrder）领域类型定义与存储容器。
 *              订单是玩家下达的"长效工作意图"，包含若干 item（可由 AI 评估并领取执行）。
 *              本文件定义订单/Item 的数据结构、状态枚举、目标引用类型，并提供 WorkOrderStore 容器
 *              用于增删查与重排序。订单创建后绑定到 GameMap，按 priorityIndex 升序排列（值小=优先级高）。
 * @dependencies 无外部依赖（纯类型定义 + 内部 ID 生成器）
 * @part-of features/work-orders — 工作订单功能
 */

import type { CellCoord } from '../../core/types';

// ── 枚举类型 ──

/** 订单来源种类：地图操作下发 / 工作台产出请求 */
export type WorkOrderSourceKind = 'map' | 'result';

/** 订单整体状态 */
export type WorkOrderStatus = 'pending' | 'active' | 'paused' | 'done' | 'cancelled';

/** 订单条目（item）状态 */
export type WorkOrderItemStatus = 'open' | 'claimed' | 'working' | 'blocked' | 'done' | 'invalid';

// ── 目标引用 ──

/**
 * 订单条目的目标引用 — 描述这个 item 要作用在什么对象/位置上
 * - object：单个具体对象（如某棵树）
 * - cell：单个格子（如某块矿）
 * - area：一组格子（如一片采集区域）
 * - result_batch：产出批次标识（结果订单使用）
 */
export interface WorkOrderItemTargetRef {
  /** 引用种类 */
  kind: 'object' | 'cell' | 'area' | 'result_batch';
  /** 当 kind='object' 时的目标对象 ID */
  objectId?: string;
  /** 当 kind='cell' 时的目标格子 */
  cell?: CellCoord;
  /** 当 kind='area' 时的格子集合 */
  cells?: CellCoord[];
  /** 当 kind='result_batch' 时的批次 ID */
  batchId?: string;
  /** 建造订单专用：目标建筑的定义 ID（kind='cell' 时使用，由 Task 4 消费） */
  defId?: string;
  /** 区域订单专用：要划设/取消的 ZoneType（kind='area' 时使用） */
  zoneType?: string;
}

// ── 订单条目与订单 ──

/** 订单条目：订单内的最小可分配工作单元 */
export interface WorkOrderItem {
  /** Item 唯一标识，格式 woi_<n> */
  id: string;
  /** 当前状态 */
  status: WorkOrderItemStatus;
  /** 目标引用 */
  targetRef: WorkOrderItemTargetRef;
  /** 当前推进到的工序阶段（可选，由 AI 推进时记录） */
  currentStage?: string;
  /** 已领取该 item 的 pawn ID（status=claimed/working 时设置） */
  claimedByPawnId?: string;
  /** 当 status=blocked 或 invalid 时的原因标记 */
  blockedReason?: string;
  /** 推进进度（0~1，可选；非长期动作可缺省） */
  progress?: number;
}

/** 工作订单：玩家下达的一组 item 的集合 */
export interface WorkOrder {
  /** 订单唯一标识，格式 wo_<n> */
  id: string;
  /** 订单来源 */
  sourceKind: WorkOrderSourceKind;
  /** 订单子类（如 'mine' / 'haul' / 'craft'，由上层语义决定，本层不限制） */
  orderKind: string;
  /** 显示标题 */
  title: string;
  /** 订单状态 */
  status: WorkOrderStatus;
  /** 优先级序号 — 数值越小优先级越高（=列表位置），由 store 维护 */
  priorityIndex: number;
  /** 创建时刻 tick */
  createdAtTick: number;
  /** 偏好执行的 pawn ID 列表（AI 优先这些 pawn） */
  preferredPawnIds: string[];
  /** 订单包含的 item 列表 */
  items: WorkOrderItem[];
}

// ── 创建订单的输入 ──

/** 创建 item 时的输入：targetRef 必填，其余字段可选（默认 status='open' 且自动生成 id） */
export interface CreateWorkOrderItemInput {
  targetRef: WorkOrderItemTargetRef;
  id?: string;
  status?: WorkOrderItemStatus;
  currentStage?: string;
  claimedByPawnId?: string;
  blockedReason?: string;
  progress?: number;
}

/** 创建订单的输入参数 */
export interface CreateWorkOrderInput {
  /** 订单子类 */
  orderKind: string;
  /** 显示标题 */
  title: string;
  /** 包含的 item（targetRef 必填，其余可选） */
  items: CreateWorkOrderItemInput[];
  /** 创建时刻 tick — 由调用方（命令处理器）从 world.tick 传入，store 不依赖 world */
  createdAtTick: number;
  /** 可选优先级序号；若未提供则追加到末尾 */
  priorityIndex?: number;
  /** 可选偏好 pawn 列表 */
  preferredPawnIds?: string[];
}

// ── 工作订单存储 ──

/**
 * WorkOrderStore — 单地图的工作订单容器。
 *
 * 不变量：
 * - list() 返回的订单按 priorityIndex 升序（值越小优先级越高）。
 * - 新订单默认追加到末尾（priorityIndex = 现有最大值 + 1，空时为 0）。
 * - 订单与 item 的状态字段为可写入字段，外部代码可直接 mutate（命令处理器、维护系统均如此）。
 *
 * ID 生成：
 * - 订单 ID 使用内部计数器，格式 wo_<n>。
 * - item ID 若输入未提供，使用内部计数器，格式 woi_<n>。
 */
export class WorkOrderStore {
  /** 订单 ID 自增计数器 */
  private nextOrderSeq = 1;
  /** Item ID 自增计数器 */
  private nextItemSeq = 1;
  /** 订单存储（id -> WorkOrder） */
  private orders: Map<string, WorkOrder> = new Map();

  /**
   * 列出所有订单，按 priorityIndex 升序排列
   * @returns 排序后的订单数组（浅拷贝列表，元素仍是引用）
   */
  list(): WorkOrder[] {
    const arr = Array.from(this.orders.values());
    arr.sort((a, b) => a.priorityIndex - b.priorityIndex);
    return arr;
  }

  /**
   * 按 ID 获取订单
   * @param orderId - 订单 ID
   * @returns 订单实例；不存在返回 undefined
   */
  get(orderId: string): WorkOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * 创建地图来源订单
   * @param input - 订单输入参数（含 orderKind/title/items/createdAtTick 等）
   * @returns 新建的 WorkOrder 实例
   */
  createMapOrder(input: CreateWorkOrderInput): WorkOrder {
    return this.createInternal('map', input);
  }

  /**
   * 创建结果订单（工作台产出请求）
   * @param input - 订单输入参数
   * @returns 新建的 WorkOrder 实例
   */
  createResultOrder(input: CreateWorkOrderInput): WorkOrder {
    return this.createInternal('result', input);
  }

  /**
   * 移除订单
   * @param orderId - 订单 ID
   * @returns 是否删除成功
   */
  removeOrder(orderId: string): boolean {
    return this.orders.delete(orderId);
  }

  /**
   * 重新排序订单 — 按传入顺序重新分配 priorityIndex（0..n-1）；
   * 未在传入列表中的订单按其原相对顺序追加在末尾。
   * @param orderIds - 期望的优先顺序（数组前面的优先级更高）
   */
  reorder(orderIds: string[]): void {
    // 当前按 priorityIndex 排好的全部订单
    const current = this.list();
    const known = new Set(orderIds);
    // 未在 orderIds 内的订单按原相对顺序保留
    const tail = current.filter(o => !known.has(o.id));
    // 按指定顺序拼接，过滤掉不存在的 ID
    const head: WorkOrder[] = [];
    for (const id of orderIds) {
      const o = this.orders.get(id);
      if (o) head.push(o);
    }
    const final = [...head, ...tail];
    final.forEach((o, idx) => { o.priorityIndex = idx; });
  }

  /**
   * 内部创建实现 — 通用流程：分配 ID、装配 item、追加到列表
   * @param sourceKind - 订单来源种类
   * @param input - 创建输入
   * @returns 新建订单
   */
  private createInternal(sourceKind: WorkOrderSourceKind, input: CreateWorkOrderInput): WorkOrder {
    const id = `wo_${this.nextOrderSeq++}`;

    // 计算默认 priorityIndex：当前最大值 + 1；空列表时为 0
    let priorityIndex = input.priorityIndex;
    if (priorityIndex === undefined) {
      let maxIdx = -1;
      for (const o of this.orders.values()) {
        if (o.priorityIndex > maxIdx) maxIdx = o.priorityIndex;
      }
      priorityIndex = maxIdx + 1;
    }

    // 装配 item — 自动生成 woi_<n>，默认 status='open'
    const items: WorkOrderItem[] = input.items.map(it => ({
      id: it.id ?? `woi_${this.nextItemSeq++}`,
      status: it.status ?? 'open',
      targetRef: it.targetRef,
      currentStage: it.currentStage,
      claimedByPawnId: it.claimedByPawnId,
      blockedReason: it.blockedReason,
      progress: it.progress,
    }));

    const order: WorkOrder = {
      id,
      sourceKind,
      orderKind: input.orderKind,
      title: input.title,
      status: 'pending',
      priorityIndex,
      createdAtTick: input.createdAtTick,
      preferredPawnIds: input.preferredPawnIds ? [...input.preferredPawnIds] : [],
      items,
    };

    this.orders.set(id, order);
    return order;
  }
}
