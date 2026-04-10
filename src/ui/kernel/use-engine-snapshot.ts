/**
 * @file use-engine-snapshot.ts
 * @description 引擎快照 Hook — 将 EngineSnapshotBridge 接入 Preact 渲染循环
 * @dependencies preact/compat — useSyncExternalStore；ui-bridge — 桥接类型；
 *               ui-types — EngineSnapshot 类型
 * @part-of ui/kernel — UI 内核层
 */

import { useSyncExternalStore } from 'preact/compat';
import type { EngineSnapshotBridge } from './ui-bridge';
import type { EngineSnapshot } from './ui-types';

/**
 * 订阅引擎快照 — 每帧 emit 后自动触发组件重渲染
 *
 * @param bridge - 引擎快照桥接实例
 * @returns 当前帧的引擎快照
 *
 * 内部使用 useSyncExternalStore 确保快照读取与 Preact 渲染同步，
 * 避免撕裂渲染（tearing）问题
 */
export function useEngineSnapshot(bridge: EngineSnapshotBridge): EngineSnapshot {
  return useSyncExternalStore(bridge.subscribe, bridge.getSnapshot);
}
