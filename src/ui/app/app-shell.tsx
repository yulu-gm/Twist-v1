/**
 * @file app-shell.tsx
 * @description 应用外壳组件 — 组装所有领域组件的顶层布局容器
 * @dependencies ui/kernel — EngineSnapshot, UiState, UiAction, UiPorts；
 *               ui/domains/colonist — 选择器和组件；
 *               ui/domains/build — 选择器和组件；
 *               ui/domains/feedback — 选择器和组件
 * @part-of ui/app — 应用层
 *
 * 这是 Preact UI 的核心组装点。所有领域组件在此处组合，
 * 通过选择器从快照中派生各自的视图模型。
 */

import type { EngineSnapshot, UiState } from '../kernel/ui-types';
import type { UiAction } from '../kernel/ui-reducer';
import type { UiPorts } from '../kernel/ui-ports';
import { selectColonistRosterRows, selectColonistInspector } from '../domains/colonist/colonist.selectors';
import { ColonistRoster } from '../domains/colonist/components/colonist-roster';
import { ColonistInspector } from '../domains/colonist/components/colonist-inspector';
import { selectTopStatusBar, selectActiveToolId } from '../domains/build/build.selectors';
import { TopStatusBar } from '../domains/build/components/top-status-bar';
import { ToolModeBar } from '../domains/build/components/tool-mode-bar';
import { activateToolAction } from '../domains/build/build.intents';
import { selectCommandFeedback, selectDebugInfo, selectShowDebugPanel } from '../domains/feedback/feedback.selectors';
import { ToastStack } from '../domains/feedback/components/toast-stack';
import { DebugPanel } from '../domains/feedback/components/debug-panel';

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
 * 应用外壳 — 顶层布局组件
 *
 * 无数据时渲染空壳占位（仅 header）。
 * 有数据时通过选择器派生各领域视图模型，组装完整 UI：
 * - 顶部：状态栏（时钟/速度/计数）
 * - 左侧：殖民者列表
 * - 右侧：殖民者检查器（单选时显示）
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
  const inspector = selectColonistInspector(snapshot, uiState);
  const feedback = selectCommandFeedback(snapshot);
  const debugInfo = selectDebugInfo(snapshot);
  const showDebug = selectShowDebugPanel(snapshot);

  return (
    <div class="app-shell" data-testid="app-shell">
      <TopStatusBar
        viewModel={topBar}
        onSetSpeed={(speed) => ports.setSpeed(speed)}
      />
      <ColonistRoster
        rows={rosterRows}
        activeId={inspector?.id ?? null}
        onSelect={(id) => ports.selectColonist(id)}
      />
      {inspector && <ColonistInspector viewModel={inspector} />}
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
