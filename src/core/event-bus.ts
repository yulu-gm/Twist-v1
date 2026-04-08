/**
 * @file event-bus.ts
 * @description 事件总线系统，实现发布-订阅模式，解耦游戏各子系统之间的通信
 * @dependencies 无外部依赖
 * @part-of core 核心模块 — 所有游戏事件（对象创建、销毁、状态变化等）通过此总线广播
 */

// ── 游戏事件 ──
/** 游戏事件对象 — 描述游戏世界中发生的一件事 */
export interface GameEvent {
  type: string;                        // 事件类型标识（如 "object_created", "command_rejected"）
  tick: number;                        // 事件发生时的 tick 数
  data: Record<string, unknown>;       // 事件携带的数据
}

/** 事件处理回调函数类型 */
export type EventHandler = (event: GameEvent) => void;

/**
 * 事件总线 — 管理事件监听器的注册、移除与事件分发
 * 支持按类型监听和全局监听两种模式
 */
export class EventBus {
  // ── 内部数据 ──
  private listeners: Map<string, Set<EventHandler>> = new Map();  // 按事件类型分组的监听器
  private globalListeners: Set<EventHandler> = new Set();          // 监听所有事件的全局监听器

  /**
   * 注册指定事件类型的监听器
   * @param type - 要监听的事件类型
   * @param handler - 事件处理回调
   */
  on(type: string, handler: EventHandler): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler);
  }

  /**
   * 移除指定事件类型的监听器
   * @param type - 事件类型
   * @param handler - 要移除的回调引用
   */
  off(type: string, handler: EventHandler): void {
    this.listeners.get(type)?.delete(handler);
  }

  /** Listen to all events */
  /**
   * 注册全局监听器（接收所有类型的事件）
   * @param handler - 事件处理回调
   */
  onAny(handler: EventHandler): void {
    this.globalListeners.add(handler);
  }

  /**
   * 移除全局监听器
   * @param handler - 要移除的回调引用
   */
  offAny(handler: EventHandler): void {
    this.globalListeners.delete(handler);
  }

  /**
   * 批量分发事件：先通知类型监听器，再通知全局监听器
   * @param events - 要分发的事件数组
   */
  dispatch(events: GameEvent[]): void {
    for (const event of events) {
      // Type-specific listeners
      const set = this.listeners.get(event.type);
      if (set) {
        for (const handler of set) {
          handler(event);
        }
      }
      // Global listeners
      for (const handler of this.globalListeners) {
        handler(event);
      }
    }
  }

  /** 清除所有监听器（用于重置或销毁） */
  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}
