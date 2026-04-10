/**
 * @file ui-bridge.ts
 * @description 引擎快照桥接 — 连接 Phaser 游戏帧循环与 Preact 渲染的核心机制
 * @dependencies ui-types — EngineSnapshot 类型
 * @part-of ui/kernel — UI 内核层
 *
 * 工作原理：
 * 1. MainScene.update() 每帧调用 bridge.emit()
 * 2. emit() 读取最新快照并通知所有订阅者
 * 3. useEngineSnapshot hook 通过 useSyncExternalStore 订阅，触发 Preact 重渲染
 */

import type { EngineSnapshot } from './ui-types';

/** 快照变更监听器 */
type Listener = () => void;

/**
 * 创建引擎快照桥接实例
 *
 * @param readSnapshot - 快照读取函数，由调用者提供（通常封装了 readEngineSnapshot）
 * @returns 桥接对象，包含 getSnapshot/subscribe/emit 三个方法
 *
 * 设计要点：
 * - getSnapshot() 返回引用稳定的快照对象（未 emit 时不变）
 * - subscribe() 遵循 useSyncExternalStore 的订阅协议
 * - emit() 在 Phaser 帧循环中调用，确保每帧最多一次渲染
 */
export function createEngineSnapshotBridge(readSnapshot: () => EngineSnapshot) {
  let snapshot = readSnapshot();
  const listeners = new Set<Listener>();

  return {
    /** 获取当前快照（引用稳定，仅 emit 后更新） */
    getSnapshot(): EngineSnapshot {
      return snapshot;
    },
    /** 订阅快照变更，返回取消订阅函数 */
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** 读取最新快照并通知所有订阅者（每帧由 MainScene 调用） */
    emit(): void {
      snapshot = readSnapshot();
      for (const listener of listeners) listener();
    },
  };
}

/** 桥接实例的类型（从工厂函数返回值推导） */
export type EngineSnapshotBridge = ReturnType<typeof createEngineSnapshotBridge>;
