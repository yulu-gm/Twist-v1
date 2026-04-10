/**
 * @file app-root.tsx
 * @description Preact 应用根组件与挂载函数 — 连接引擎桥接和 UI 状态管理
 * @dependencies preact — render；preact/hooks — useReducer；
 *               app-shell — 外壳组件；ui/kernel — reducer, bridge, ports, snapshot hook；
 *               ui/styles — CSS tokens 和全局样式
 * @part-of ui/app — 应用层
 *
 * 数据流：
 * bridge.emit() → useEngineSnapshot() → snapshot → selectors → AppShell → components
 * user interaction → ports.xxx() → commandQueue/presentation mutation
 */

import { render } from 'preact';
import { useReducer } from 'preact/hooks';
import { AppShell } from './app-shell';
import { createInitialUiState, uiReducer } from '../kernel/ui-reducer';
import { useEngineSnapshot } from '../kernel/use-engine-snapshot';
import type { EngineSnapshotBridge } from '../kernel/ui-bridge';
import type { UiPorts } from '../kernel/ui-ports';
import '../styles/tokens.css';
import '../styles/app.css';

/**
 * 应用根组件 — 连接引擎快照和 UI 状态到外壳组件
 *
 * 通过 useEngineSnapshot 订阅每帧快照更新，
 * 通过 useReducer 管理 UI 本地状态
 */
function AppRoot({ bridge, ports }: { bridge: EngineSnapshotBridge; ports: UiPorts }) {
  const snapshot = useEngineSnapshot(bridge);
  const [uiState, dispatch] = useReducer(uiReducer, undefined, createInitialUiState);
  return <AppShell snapshot={snapshot} uiState={uiState} dispatch={dispatch} ports={ports} />;
}

/**
 * 挂载 Preact UI 应用到指定 DOM 节点
 *
 * @param root - 挂载目标 DOM 元素（通常是 #ui-root）
 * @param bridge - 引擎快照桥接（可选，无则渲染空壳）
 * @param ports - UI 端口（可选，无则渲染空壳）
 *
 * 当 bridge 和 ports 都提供时渲染完整 UI（AppRoot），
 * 否则渲染空壳占位（AppShell 无数据模式）
 */
export function mountUiApp(root: HTMLElement, bridge?: EngineSnapshotBridge, ports?: UiPorts): void {
  if (bridge && ports) {
    render(<AppRoot bridge={bridge} ports={ports} />, root);
  } else {
    render(<AppShell />, root);
  }
}
