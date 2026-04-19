/**
 * @file work-order.selectors.ts
 * @description 工作订单领域选择器 — 从 EngineSnapshot + UiState + CompletionTrackerState 派生看板视图模型
 * @dependencies ui/kernel/ui-types — EngineSnapshot, UiState, WorkOrderNode；
 *               work-order.types — WorkOrderBoardViewModel 等；
 *               use-completion-tracker — CompletionTrackerState
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import type { EngineSnapshot, UiState, WorkOrderNode } from '../../kernel/ui-types';
import type {
  WorkOrderBoardViewModel,
  WorkOrderRow,
  WorkOrderDetailViewModel,
} from './work-order.types';
import type { CompletionTrackerState } from './use-completion-tracker';

/**
 * 兜底标题 — 当节点 title 为空时，使用 "${orderKind} (${totalItemCount})" 作为占位，
 * 保证看板永远不会渲染空白行
 */
function deriveTitle(node: WorkOrderNode): string {
  if (node.title && node.title.length > 0) return node.title;
  return `${node.orderKind} (${node.totalItemCount})`;
}

/**
 * 把单个 WorkOrderNode 投影为列表行 — 同时格式化进度与活跃工人标签，并标注 displayPhase
 */
function toRow(node: WorkOrderNode, completion: CompletionTrackerState): WorkOrderRow {
  // displayPhase 派生：exiting 优先级最高，其次 completing，否则 normal
  let displayPhase: WorkOrderRow['displayPhase'] = 'normal';
  if (completion.exitingIds.has(node.id)) {
    displayPhase = 'exiting';
  } else if (completion.completingDoneAt.has(node.id)) {
    displayPhase = 'completing';
  }
  return {
    id: node.id,
    title: deriveTitle(node),
    sourceKind: node.sourceKind,
    priorityIndex: node.priorityIndex,
    progressLabel: `${node.doneItemCount} / ${node.totalItemCount}`,
    activeWorkerLabel: node.activeWorkerCount > 0 ? `${node.activeWorkerCount} 人` : '—',
    blocked: node.blocked,
    status: node.status,
    displayPhase,
  };
}

/**
 * 把单个 WorkOrderNode 投影为详情视图模型 — 复制 item 列表
 */
function toDetail(node: WorkOrderNode): WorkOrderDetailViewModel {
  return {
    id: node.id,
    title: deriveTitle(node),
    items: node.items.map(item => ({
      id: item.id,
      status: item.status,
      blockedReason: item.blockedReason,
      currentStage: item.currentStage,
      claimedByPawnId: item.claimedByPawnId,
    })),
  };
}

/**
 * 选择工作订单看板视图模型 — 从快照 workOrders 生成行列表，
 * 应用完成淡出窗口（completion）过滤 hidden、派生 displayPhase；
 * 并基于 uiState.inspectorTargetId 推导当前选中订单及其详情。
 *
 * @param snapshot - 引擎快照
 * @param uiState - UI 本地状态（提供 inspectorTargetId）
 * @param completion - 来自 useCompletionTracker 的窗口状态
 * @returns 看板视图模型（rows + selectedOrderId + detail + suggestedExpanded）
 */
export function selectWorkOrderBoard(
  snapshot: EngineSnapshot,
  uiState: UiState,
  completion: CompletionTrackerState,
): WorkOrderBoardViewModel {
  const workOrders = snapshot.workOrders;

  // 先按 hiddenIds 过滤，再投影为行
  const rows = workOrders.list
    .filter(node => !completion.hiddenIds.has(node.id))
    .map(node => toRow(node, completion));

  // 仅当 inspectorTargetId 命中订单 ID 且未被 hidden 时才视为有效选中
  const targetId = uiState.inspectorTargetId;
  const selectedNode = targetId && !completion.hiddenIds.has(targetId)
    ? workOrders.byId[targetId]
    : undefined;
  const selectedOrderId = selectedNode ? selectedNode.id : null;
  const detail = selectedNode ? toDetail(selectedNode) : null;

  return {
    rows,
    selectedOrderId,
    detail,
    suggestedExpanded: rows.length > 0,
  };
}
