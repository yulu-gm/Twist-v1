/**
 * @file work-order.types.ts
 * @description 工作订单 UI 领域类型 — 看板行、详情面板视图模型
 * @dependencies ui/kernel/ui-types — WorkOrderNode/WorkOrderItemNode 状态枚举
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import type { WorkOrderNode, WorkOrderItemNode } from '../../kernel/ui-types';

/**
 * 看板单行视图模型 — 投影到列表行的扁平数据
 */
export interface WorkOrderRow {
  /** 订单 ID */
  id: string;
  /** 显示标题（已对空标题做兜底） */
  title: string;
  /** 订单来源（map=玩家手开，result=工作台产出） */
  sourceKind: 'map' | 'result';
  /** 优先级序号（越小越靠前） */
  priorityIndex: number;
  /** 进度文案，如 "2 / 5" */
  progressLabel: string;
  /** 当前活跃工人文案，如 "1 人"；为 0 时显示 "—" */
  activeWorkerLabel: string;
  /** 是否整体阻塞 */
  blocked: boolean;
  /** 订单整体状态（用于状态徽章着色） */
  status: WorkOrderNode['status'];
  /**
   * UI 派生显示相位，由 selector 根据 completionState 计算
   * - 'normal'：正常显示（pending/active/paused，或终态但尚未观测）
   * - 'completing'：done 后 2000ms 内的高亮窗口（显示 ✓ + 划线）
   * - 'exiting'：完成窗口结束或 cancelled，正在播放退出动画的 240ms 内
   *
   * 已加入 hiddenIds 的订单会被 selector 过滤掉，不出现在 rows 中。
   */
  displayPhase: 'normal' | 'completing' | 'exiting';
}

/**
 * 详情面板单 item 视图模型
 */
export interface WorkOrderDetailItem {
  /** Item ID */
  id: string;
  /** Item 状态 */
  status: WorkOrderItemNode['status'];
  /** 阻塞/失效原因（无则 null） */
  blockedReason: string | null;
  /** 当前工序阶段（无则 null） */
  currentStage: string | null;
  /** 已领取的 pawn ID（无则 null） */
  claimedByPawnId: string | null;
}

/**
 * 详情面板视图模型 — 展示当前选中订单的 item 列表
 */
export interface WorkOrderDetailViewModel {
  /** 订单 ID */
  id: string;
  /** 订单显示标题 */
  title: string;
  /** 订单包含的 item 列表 */
  items: WorkOrderDetailItem[];
}

/**
 * 看板顶层视图模型 — 选择器返回的完整数据包
 */
export interface WorkOrderBoardViewModel {
  /** 行列表（按 priorityIndex 升序，已由快照保证） */
  rows: WorkOrderRow[];
  /** 当前选中订单 ID（仅当 inspectorTargetId 命中订单时） */
  selectedOrderId: string | null;
  /** 选中订单的详情视图模型（无选中则 null） */
  detail: WorkOrderDetailViewModel | null;
  /**
   * 自动建议的展开状态 — `rows.length > 0` 时为 true。
   * 由 selector 派生，hook 据此决定是否清空用户折叠覆盖。
   */
  suggestedExpanded: boolean;
}
