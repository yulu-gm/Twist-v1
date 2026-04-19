/**
 * @file use-completion-tracker.ts
 * @description 跟踪订单完成淡出窗口 — 把 done/cancelled 订单分阶段推进到 hidden
 * @dependencies preact/hooks — useEffect/useRef/useReducer；
 *               ui/kernel/ui-types — WorkOrderNode 状态枚举
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 *
 * 时间窗口：
 * - done 出现：completingDoneAt[id] = now，进入 'completing' 相位
 * - 2000ms 后：ID 加入 exitingIds 并写入 exitingStartAt[id] = now，进入 'exiting' 相位
 * - 再 240ms 后：ID 加入 hiddenIds，selector 过滤
 * - cancelled：跳过 completing，直接进入 exitingIds，同时写 exitingStartAt[id] = now，再 240ms 后 hidden
 *
 * 用 wall-clock Date.now() 推进，引擎暂停或速度变化不影响 UI 计时（有意为之）。
 */

import { useEffect, useReducer, useRef } from 'preact/hooks';
import type { WorkOrderNode } from '../../kernel/ui-types';

/** 完成阶段持续时长（ms） */
const COMPLETING_DURATION_MS = 2000;
/** 退出动画持续时长（ms） */
const EXITING_DURATION_MS = 240;

/** Hook 输出 — 供 selector 派生 displayPhase 与过滤 hidden */
export interface CompletionTrackerState {
  /** done 订单进入 completing 相位的时刻 */
  completingDoneAt: Map<string, number>;
  /** 已进入 exiting 相位的订单 ID */
  exitingIds: Set<string>;
  /**
   * 进入 exiting 相位的时刻（done 完成 2000ms 后或 cancelled 出现时）。
   * @internal 仅供 hook 内部推进时间使用，selector 不消费。
   */
  exitingStartAt: Map<string, number>;
  /** 已应被 selector 过滤的订单 ID */
  hiddenIds: Set<string>;
}

/**
 * 跟踪订单完成淡出窗口
 *
 * @param orders - 当前快照中的全部订单（含 done/cancelled）
 * @returns 当前 completion 状态
 */
export function useCompletionTracker(orders: readonly WorkOrderNode[]): CompletionTrackerState {
  /**
   * 持久化状态对象 — 跨 render 共享 Map/Set。
   * 用 ref 而非 state 是因为：内部突变 + 外部用 forceUpdate 触发重渲染，
   * 避免每次 setState 重建对象。
   */
  const stateRef = useRef<CompletionTrackerState>({
    completingDoneAt: new Map(),
    exitingIds: new Set(),
    exitingStartAt: new Map(),
    hiddenIds: new Set(),
  });
  const timerRef = useRef<number | null>(null);
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  // 同步阶段 — 每次 render 立刻处理新出现的终态订单与已过期的窗口
  // 这样首次渲染时 done 订单立刻就在 completingDoneAt 中（满足测试：done 出现立即可见）
  const state = stateRef.current;
  const now = Date.now();

  // 新出现的终态订单：done 进 completing；cancelled 直接进 exiting
  for (const order of orders) {
    if (order.status === 'done') {
      if (!state.completingDoneAt.has(order.id) && !state.exitingIds.has(order.id) && !state.hiddenIds.has(order.id)) {
        state.completingDoneAt.set(order.id, now);
      }
    } else if (order.status === 'cancelled') {
      if (!state.exitingIds.has(order.id) && !state.hiddenIds.has(order.id)) {
        state.exitingIds.add(order.id);
        // cancelled 直接进入 exiting 相位 — 仅写 exitingStartAt，不污染 completingDoneAt
        state.exitingStartAt.set(order.id, now);
      }
    }
  }

  // 已过期的 completing 推进到 exiting
  for (const [id, doneAt] of state.completingDoneAt) {
    if (state.exitingIds.has(id) || state.hiddenIds.has(id)) continue;
    if (now - doneAt >= COMPLETING_DURATION_MS) {
      state.exitingIds.add(id);
      // 记录 exiting 起点 — 与 completingDoneAt 分离，避免覆盖 done 进入 completing 的时刻
      state.exitingStartAt.set(id, now);
    }
  }

  // 已过期的 exiting 推进到 hidden — 时间基准取 exitingStartAt
  for (const id of state.exitingIds) {
    const enteredAt = state.exitingStartAt.get(id);
    if (enteredAt == null) continue;
    if (now - enteredAt >= EXITING_DURATION_MS && !state.hiddenIds.has(id)) {
      state.hiddenIds.add(id);
    }
  }

  // 安排下一次推进：取所有未到期窗口的最近 deadline
  // exiting 中的 ID 读 exitingStartAt + EXITING_DURATION_MS；仍在 completing 的 ID 读 completingDoneAt + COMPLETING_DURATION_MS
  // 故意不传 deps — Map/Set 原地变更不会被引用相等检测到，每次 render 重排定时器最稳妥
  useEffect(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    let nextDelay = Infinity;
    // 仍在 completing 相位（在 completingDoneAt 中且未进入 exiting/hidden）
    for (const [id, doneAt] of state.completingDoneAt) {
      if (state.exitingIds.has(id) || state.hiddenIds.has(id)) continue;
      const remaining = COMPLETING_DURATION_MS - (Date.now() - doneAt);
      if (remaining < nextDelay) nextDelay = remaining;
    }
    // 已进入 exiting 相位（在 exitingIds 中且未进入 hidden）
    for (const id of state.exitingIds) {
      if (state.hiddenIds.has(id)) continue;
      const enteredAt = state.exitingStartAt.get(id);
      if (enteredAt == null) continue;
      const remaining = EXITING_DURATION_MS - (Date.now() - enteredAt);
      if (remaining < nextDelay) nextDelay = remaining;
    }
    if (nextDelay !== Infinity) {
      const delay = Math.max(0, nextDelay);
      timerRef.current = window.setTimeout(() => forceUpdate(), delay);
      return () => { if (timerRef.current != null) window.clearTimeout(timerRef.current); };
    }
    return undefined;
  });

  return state;
}
