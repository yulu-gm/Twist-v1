/**
 * @file app-shell.tsx
 * @description 应用外壳组件 — 组装所有领域组件的顶层布局容器
 * @dependencies ui/kernel — EngineSnapshot, UiState, UiAction, UiPorts；
 *               ui/domains/colonist — 殖民者列表；
 *               ui/domains/inspector — 统一 Object Inspector；
 *               ui/domains/build — 工具栏；
 *               ui/domains/feedback — 反馈提示
 * @part-of ui/app — 应用层
 *
 * 这是 Preact UI 的核心组装点。所有领域组件在此处组合，
 * 通过选择器从快照中派生各自的视图模型。
 */

import type { EngineSnapshot, UiState } from '../kernel/ui-types';
import type { UiAction } from '../kernel/ui-reducer';
import type { UiPorts } from '../kernel/ui-ports';
import { selectColonistRosterRows } from '../domains/colonist/colonist.selectors';
import { ColonistRoster } from '../domains/colonist/components/colonist-roster';
import { selectObjectInspector } from '../domains/inspector/inspector.selectors';
import { ObjectInspector } from '../domains/inspector/components/object-inspector';
import { selectTopStatusBar, selectActiveToolId } from '../domains/build/build.selectors';
import { TopStatusBar } from '../domains/build/components/top-status-bar';
import { ToolModeBar } from '../domains/build/components/tool-mode-bar';
import { activateToolAction } from '../domains/build/build.intents';
import { selectCommandFeedback, selectDebugInfo, selectShowDebugPanel } from '../domains/feedback/feedback.selectors';
import { ToastStack } from '../domains/feedback/components/toast-stack';
import { DebugPanel } from '../domains/feedback/components/debug-panel';
import { selectWorkOrderBoard } from '../domains/work-orders/work-order.selectors';
import { WorkOrderBoard } from '../domains/work-orders/components/work-order-board';
import { useCompletionTracker } from '../domains/work-orders/use-completion-tracker';
import { useCollapseState } from '../domains/work-orders/use-collapse-state';

/** AppShell 组件属性 — 所有数据和回调从 AppRoot 注入 */
interface AppShellProps {
  /** 引擎快照（可选，无则渲染空壳占位） */
  snapshot?: EngineSnapshot;
  /** UI 本地状态 */
  uiState?: UiState;
  /** UI 状态 dispatch 函数 */
  dispatch?: (action: UiAction) => void;
  /** UI 端口（副作用出口） */
  ports?: UiPorts;
}

/**
 * Inspector action 分发 — 将 Inspector 操作转换为 UiPorts 调用
 *
 * 集中处理所有 Inspector adapter 声明的 action
 */
function handleInspectorAction(ports: UiPorts, actionId: string, targetId: string): void {
  switch (actionId) {
    case 'assign_bed_owner':
      // 床位分配需要弹出选择器 — 暂时使用 dispatchCommand 占位
      break;
    case 'clear_bed_owner':
      ports.clearBedOwner(targetId);
      break;
    case 'cancel_construction':
      ports.dispatchCommand({ type: 'cancel_construction', payload: { targetId } });
      break;
    case 'designate_harvest':
      ports.dispatchCommand({ type: 'designate_harvest', payload: { targetId } });
      break;
    case 'designate_cut':
      ports.dispatchCommand({ type: 'designate_cut', payload: { targetId } });
      break;
  }
}

/**
 * 应用外壳 — 顶层布局组件
 *
 * 无数据时渲染空壳占位（仅 header）。
 * 有数据时通过选择器派生各领域视图模型，组装完整 UI：
 * - 顶部：状态栏（时钟/速度/计数）
 * - 左侧：殖民者列表
 * - 右侧：统一 Object Inspector（选中对象时显示）
 * - 右下：Toast 提示栈
 * - 右上：调试面板（F1 切换）
 * - 底部：工具模式栏
 */
export function AppShell({ snapshot, uiState, dispatch, ports }: AppShellProps) {
  if (!snapshot || !uiState || !dispatch || !ports) {
    return (
      <div class="app-shell" data-testid="app-shell">
        <header>Opus UI</header>
      </div>
    );
  }

  // 从快照中派生各领域视图模型
  const topBar = selectTopStatusBar(snapshot);
  const activeToolId = selectActiveToolId(snapshot);
  const rosterRows = selectColonistRosterRows(snapshot, uiState);
  const objectInspector = selectObjectInspector(snapshot, uiState);
  const feedback = selectCommandFeedback(snapshot);
  const debugInfo = selectDebugInfo(snapshot);
  const showDebug = selectShowDebugPanel(snapshot);
  // 工单看板 — 先跟踪完成淡出窗口，再投影视图模型，再决定折叠状态
  const completion = useCompletionTracker(snapshot.workOrders.list);
  const workOrderBoard = selectWorkOrderBoard(snapshot, uiState, completion);
  const collapse = useCollapseState(workOrderBoard.suggestedExpanded);

  return (
    <div class="app-shell" data-testid="app-shell">
      <TopStatusBar
        viewModel={topBar}
        onSetSpeed={(speed) => ports.setSpeed(speed)}
      />
      <ColonistRoster
        rows={rosterRows}
        activeId={snapshot.selection.primaryId}
        onSelect={(id) => ports.selectColonist(id)}
      />
      <WorkOrderBoard
        rows={workOrderBoard.rows}
        selectedOrderId={workOrderBoard.selectedOrderId}
        detail={workOrderBoard.detail}
        expanded={collapse.expanded}
        onToggle={collapse.toggle}
        onSelect={(orderId) => dispatch({ type: 'set_inspector_target', targetId: orderId })}
        onPause={(orderId) => ports.pauseWorkOrder(orderId)}
        onResume={(orderId) => ports.resumeWorkOrder(orderId)}
        onCancel={(orderId) => ports.cancelWorkOrder(orderId)}
      />
      {objectInspector && (
        <ObjectInspector
          viewModel={objectInspector}
          onSelectTarget={(targetId) => dispatch({ type: 'set_inspector_target', targetId })}
          onRunAction={(actionId, targetId) => handleInspectorAction(ports, actionId, targetId)}
          onAssignBedOwner={(bedId, pawnId) => ports.assignBedOwner(bedId, pawnId)}
          onClearBedOwner={(bedId) => ports.clearBedOwner(bedId)}
        />
      )}
      <ToastStack toasts={feedback.toasts} />
      <DebugPanel visible={showDebug} debugInfo={debugInfo} />
      <ToolModeBar
        activeToolId={activeToolId}
        activeTool={snapshot.presentation.activeTool}
        onActivate={(action) => activateToolAction(ports, action)}
      />
    </div>
  );
}
