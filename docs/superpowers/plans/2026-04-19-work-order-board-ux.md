# 工单看板 UX 改造实施计划（自动收起 + 完成动效）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让左侧工单看板根据订单数自动展开/收起、订单完成时显示打勾+划线并在约 2 秒后淡出，并为所有变化提供统一的动效语言。

**Architecture:** 改动收敛在 `src/ui/domains/work-orders/`，selector 继续输出纯函数视图模型；新增两个 hook 管理 UI 时间状态（完成淡出窗口、用户折叠覆盖），通过 `useLayoutEffect` 与 `requestAnimationFrame` 推进；动效靠 CSS class + max-height + opacity 实现，不引入动画库。

**Tech Stack:** Preact 10 + preact/hooks，TypeScript，Vitest + @testing-library/preact，原生 CSS（`src/ui/styles/app.css`）。

**Spec:** `docs/superpowers/specs/2026-04-19-work-order-board-ux-design.md`

---

## 文件结构

| 文件 | 类型 | 责任 |
|---|---|---|
| `src/ui/domains/work-orders/work-order.types.ts` | 修改 | 增加 `displayPhase` 与 `suggestedExpanded` 类型字段 |
| `src/ui/domains/work-orders/work-order.selectors.ts` | 修改 | 接收 `completionState`，派生 `displayPhase`、过滤 hidden、计算 `suggestedExpanded` |
| `src/ui/domains/work-orders/use-completion-tracker.ts` | 新建 | hook，跟踪 done/cancelled 订单的淡出窗口 |
| `src/ui/domains/work-orders/use-completion-tracker.test.ts` | 新建 | hook 单元测试（fake timers） |
| `src/ui/domains/work-orders/use-collapse-state.ts` | 新建 | hook，管理用户折叠覆盖与"rows 0→1 自动展开" |
| `src/ui/domains/work-orders/use-collapse-state.test.ts` | 新建 | hook 单元测试 |
| `src/ui/domains/work-orders/work-order.selectors.test.ts` | 新建 | selector 单元测试，覆盖 displayPhase + suggestedExpanded + hidden 过滤 |
| `src/ui/domains/work-orders/components/work-order-board.tsx` | 修改 | 增加标题条按钮、折叠列表区、行根据 displayPhase 加 class、行渲染 ✓ |
| `src/ui/domains/work-orders/components/work-order-board.test.tsx` | 修改 | 扩展测试覆盖收起态/点击切换/完成态行渲染 |
| `src/ui/app/app-shell.tsx` | 修改 | 串联两个 hook + selector，把 expanded/onToggle 透传给 WorkOrderBoard |
| `src/ui/styles/app.css` | 修改 | 新增 work-order 段动效 keyframes / class，定义 reduced-motion 退化 |

---

## Task 1：在类型层加入 `displayPhase` 与 `suggestedExpanded`

**Files:**
- Modify: `src/ui/domains/work-orders/work-order.types.ts`

- [ ] **Step 1: 在 `WorkOrderRow` 增加 `displayPhase` 字段**

修改 `src/ui/domains/work-orders/work-order.types.ts`，在 `WorkOrderRow` 接口末尾追加字段（保留所有原注释，新增字段写中文 JSDoc）：

```ts
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
```

- [ ] **Step 2: 在 `WorkOrderBoardViewModel` 增加 `suggestedExpanded`**

```ts
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
```

- [ ] **Step 3: 跑类型检查确认接口扩展未破坏现有引用**

Run: `npx tsc --noEmit`
Expected: 失败列表中应只剩 selector / 组件等"待实现"位置的 missing field 错误（这些将在后续 task 修复），不应有不相关错误。

- [ ] **Step 4: 提交**

```bash
git add src/ui/domains/work-orders/work-order.types.ts
git commit -m "feat(work-orders): add displayPhase and suggestedExpanded to view model types"
```

---

## Task 2：新建 `use-completion-tracker` hook（先写测试）

**Files:**
- Test: `src/ui/domains/work-orders/use-completion-tracker.test.ts`
- Create: `src/ui/domains/work-orders/use-completion-tracker.ts`

时间窗口：done 出现 → 立即记录到 `completingDoneAt[id] = now` → 2000ms 后 ID 进入 `exitingIds` → 再过 240ms 进入 `hiddenIds`。cancelled 跳过 completing 阶段，直接进入 `exitingIds`，240ms 后进入 `hiddenIds`。

- [ ] **Step 1: 写失败测试**

创建 `src/ui/domains/work-orders/use-completion-tracker.test.ts`，内容：

```ts
/**
 * @file use-completion-tracker.test.ts
 * @description useCompletionTracker hook 测试 — 验证完成淡出窗口的时间推进
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import { renderHook, act } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkOrderNode } from '../../kernel/ui-types';
import { useCompletionTracker } from './use-completion-tracker';

/** 构造一个最小 WorkOrderNode，用于驱动 hook 输入 */
function makeNode(id: string, status: WorkOrderNode['status']): WorkOrderNode {
  return {
    id,
    title: id,
    sourceKind: 'map',
    orderKind: 'cut',
    priorityIndex: 0,
    status,
    blocked: false,
    totalItemCount: 1,
    doneItemCount: status === 'done' ? 1 : 0,
    activeWorkerCount: 0,
    items: [],
  };
}

describe('useCompletionTracker', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('marks done order as completing immediately, then exiting after 2000ms, then hidden after another 240ms', () => {
    const t0 = 1_000_000;
    vi.setSystemTime(t0);
    const { result, rerender } = renderHook(
      ({ orders }: { orders: WorkOrderNode[] }) => useCompletionTracker(orders),
      { initialProps: { orders: [makeNode('wo_1', 'done')] } },
    );

    expect(result.current.completingDoneAt.get('wo_1')).toBe(t0);
    expect(result.current.exitingIds.has('wo_1')).toBe(false);
    expect(result.current.hiddenIds.has('wo_1')).toBe(false);

    act(() => { vi.setSystemTime(t0 + 2000); vi.advanceTimersByTime(2000); });
    rerender({ orders: [makeNode('wo_1', 'done')] });
    expect(result.current.exitingIds.has('wo_1')).toBe(true);
    expect(result.current.hiddenIds.has('wo_1')).toBe(false);

    act(() => { vi.setSystemTime(t0 + 2240); vi.advanceTimersByTime(240); });
    rerender({ orders: [makeNode('wo_1', 'done')] });
    expect(result.current.hiddenIds.has('wo_1')).toBe(true);
  });

  it('cancelled order skips completing, goes straight to exiting then hidden', () => {
    const t0 = 2_000_000;
    vi.setSystemTime(t0);
    const { result, rerender } = renderHook(
      ({ orders }: { orders: WorkOrderNode[] }) => useCompletionTracker(orders),
      { initialProps: { orders: [makeNode('wo_2', 'cancelled')] } },
    );

    expect(result.current.completingDoneAt.has('wo_2')).toBe(false);
    expect(result.current.exitingIds.has('wo_2')).toBe(true);
    expect(result.current.hiddenIds.has('wo_2')).toBe(false);

    act(() => { vi.setSystemTime(t0 + 240); vi.advanceTimersByTime(240); });
    rerender({ orders: [makeNode('wo_2', 'cancelled')] });
    expect(result.current.hiddenIds.has('wo_2')).toBe(true);
  });

  it('keeps separate timers for multiple terminal orders', () => {
    const t0 = 3_000_000;
    vi.setSystemTime(t0);
    const { result, rerender } = renderHook(
      ({ orders }: { orders: WorkOrderNode[] }) => useCompletionTracker(orders),
      { initialProps: { orders: [makeNode('a', 'done')] } },
    );

    act(() => { vi.setSystemTime(t0 + 1000); vi.advanceTimersByTime(1000); });
    rerender({ orders: [makeNode('a', 'done'), makeNode('b', 'done')] });
    expect(result.current.completingDoneAt.get('a')).toBe(t0);
    expect(result.current.completingDoneAt.get('b')).toBe(t0 + 1000);

    act(() => { vi.setSystemTime(t0 + 2000); vi.advanceTimersByTime(1000); });
    rerender({ orders: [makeNode('a', 'done'), makeNode('b', 'done')] });
    expect(result.current.exitingIds.has('a')).toBe(true);
    expect(result.current.exitingIds.has('b')).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/ui/domains/work-orders/use-completion-tracker.test.ts`
Expected: FAIL，提示 `useCompletionTracker` 未找到模块。

- [ ] **Step 3: 实现 hook**

创建 `src/ui/domains/work-orders/use-completion-tracker.ts`：

```ts
/**
 * @file use-completion-tracker.ts
 * @description 跟踪订单完成淡出窗口 — 把 done/cancelled 订单分阶段推进到 hidden
 * @dependencies preact/hooks — useEffect/useRef/useReducer；
 *               ui/kernel/ui-types — WorkOrderNode 状态枚举
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 *
 * 时间窗口：
 * - done 出现：completingDoneAt[id] = now，进入 'completing' 相位
 * - 2000ms 后：ID 加入 exitingIds，进入 'exiting' 相位
 * - 再 240ms 后：ID 加入 hiddenIds，selector 过滤
 * - cancelled：跳过 completing，直接进入 exitingIds，再 240ms 后 hidden
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
  /** 进入 completing 相位的时刻（done 订单） */
  completingDoneAt: Map<string, number>;
  /** 已进入 exiting 相位的订单 ID */
  exitingIds: Set<string>;
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
    hiddenIds: new Set(),
  });
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  // 同步阶段 — 每次 render 立刻处理新出现的终态订单与已过期的窗口
  // 这样首次渲染时 done 订单立刻就在 completingDoneAt 中（满足测试：done 出现立即可见）
  const state = stateRef.current;
  const now = Date.now();
  let mutated = false;

  // 新出现的终态订单：done 进 completing；cancelled 直接进 exiting
  for (const order of orders) {
    if (order.status === 'done') {
      if (!state.completingDoneAt.has(order.id) && !state.exitingIds.has(order.id) && !state.hiddenIds.has(order.id)) {
        state.completingDoneAt.set(order.id, now);
        mutated = true;
      }
    } else if (order.status === 'cancelled') {
      if (!state.exitingIds.has(order.id) && !state.hiddenIds.has(order.id)) {
        state.exitingIds.add(order.id);
        mutated = true;
        // 同时记录 cancelled 进入 exiting 的时刻，复用 completingDoneAt 字段当作"exiting 起点时间戳"
        state.completingDoneAt.set(order.id, now);
      }
    }
  }

  // 已过期的 completing 推进到 exiting
  for (const [id, doneAt] of state.completingDoneAt) {
    if (state.exitingIds.has(id) || state.hiddenIds.has(id)) continue;
    if (now - doneAt >= COMPLETING_DURATION_MS) {
      state.exitingIds.add(id);
      // 重设为 exiting 起点
      state.completingDoneAt.set(id, now);
      mutated = true;
    }
  }

  // 已过期的 exiting 推进到 hidden
  for (const id of state.exitingIds) {
    const enteredAt = state.completingDoneAt.get(id);
    if (enteredAt == null) continue;
    if (now - enteredAt >= EXITING_DURATION_MS && !state.hiddenIds.has(id)) {
      state.hiddenIds.add(id);
      mutated = true;
    }
  }

  // 安排下一次推进：取所有未到期窗口的最近 deadline
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    let nextDelay = Infinity;
    for (const [id, doneAt] of state.completingDoneAt) {
      if (state.hiddenIds.has(id)) continue;
      const targetDuration = state.exitingIds.has(id) ? EXITING_DURATION_MS : COMPLETING_DURATION_MS;
      const remaining = targetDuration - (Date.now() - doneAt);
      if (remaining < nextDelay) nextDelay = remaining;
    }
    if (nextDelay !== Infinity) {
      const delay = Math.max(0, nextDelay);
      timerRef.current = window.setTimeout(() => forceUpdate(), delay);
      return () => { if (timerRef.current != null) window.clearTimeout(timerRef.current); };
    }
    return undefined;
  });

  // 静默：参数未实际使用 — 仅写下 mutated 以避免误删上面的判定逻辑
  void mutated;

  return state;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/ui/domains/work-orders/use-completion-tracker.test.ts`
Expected: 全部 3 个测试通过。

- [ ] **Step 5: 提交**

```bash
git add src/ui/domains/work-orders/use-completion-tracker.ts src/ui/domains/work-orders/use-completion-tracker.test.ts
git commit -m "feat(work-orders): add useCompletionTracker hook for fade-out window"
```

---

## Task 3：新建 `use-collapse-state` hook（先写测试）

**Files:**
- Test: `src/ui/domains/work-orders/use-collapse-state.test.ts`
- Create: `src/ui/domains/work-orders/use-collapse-state.ts`

规则：
- 默认遵循 `suggestedExpanded`。
- 用户调用 `toggle()` 后写入 `userOverride` 并坚持。
- `suggestedExpanded` 从 false 跨越到 true 时清空 `userOverride`（让新订单一定能被看到）。

- [ ] **Step 1: 写失败测试**

创建 `src/ui/domains/work-orders/use-collapse-state.test.ts`：

```ts
/**
 * @file use-collapse-state.test.ts
 * @description useCollapseState hook 测试 — 验证用户覆盖与"rows 0→1 自动展开"逻辑
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import { renderHook, act } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { useCollapseState } from './use-collapse-state';

describe('useCollapseState', () => {
  it('follows suggestedExpanded when no user override', () => {
    const { result, rerender } = renderHook(
      ({ suggested }: { suggested: boolean }) => useCollapseState(suggested),
      { initialProps: { suggested: false } },
    );
    expect(result.current.expanded).toBe(false);
    rerender({ suggested: true });
    expect(result.current.expanded).toBe(true);
  });

  it('user toggle overrides suggested while suggested stays true', () => {
    const { result, rerender } = renderHook(
      ({ suggested }: { suggested: boolean }) => useCollapseState(suggested),
      { initialProps: { suggested: true } },
    );
    expect(result.current.expanded).toBe(true);
    act(() => { result.current.toggle(); });
    expect(result.current.expanded).toBe(false);
    rerender({ suggested: true });
    expect(result.current.expanded).toBe(false);
  });

  it('clears user override when suggested crosses false → true', () => {
    const { result, rerender } = renderHook(
      ({ suggested }: { suggested: boolean }) => useCollapseState(suggested),
      { initialProps: { suggested: true } },
    );
    act(() => { result.current.toggle(); });
    expect(result.current.expanded).toBe(false);

    rerender({ suggested: false });
    expect(result.current.expanded).toBe(false);

    rerender({ suggested: true });
    expect(result.current.expanded).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/ui/domains/work-orders/use-collapse-state.test.ts`
Expected: FAIL，模块未找到。

- [ ] **Step 3: 实现 hook**

创建 `src/ui/domains/work-orders/use-collapse-state.ts`：

```ts
/**
 * @file use-collapse-state.ts
 * @description 管理工单看板的折叠状态 — 自动建议 + 用户覆盖
 * @dependencies preact/hooks — useState/useRef/useCallback
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 *
 * 规则：
 * - 默认 expanded = suggestedExpanded
 * - 用户 toggle() 后 userOverride 接管
 * - suggestedExpanded 从 false 跨越到 true 时清空 userOverride
 *   （新订单一定能被看到，不会被旧的"用户已收起"卡住）
 */

import { useCallback, useRef, useState } from 'preact/hooks';

/** Hook 输出 */
export interface CollapseStateHandle {
  /** 当前是否展开 */
  expanded: boolean;
  /** 切换 — 写入用户覆盖 */
  toggle: () => void;
}

/**
 * 管理折叠状态
 *
 * @param suggestedExpanded - selector 计算出的建议状态（rows.length > 0）
 */
export function useCollapseState(suggestedExpanded: boolean): CollapseStateHandle {
  const [override, setOverride] = useState<boolean | null>(null);
  // 记录上一次 suggestedExpanded，用于侦测 false → true 跨越
  const prevSuggestedRef = useRef<boolean>(suggestedExpanded);

  // 同步阶段处理跨越 — 在 render 内直接清覆盖，避免一帧延迟
  if (!prevSuggestedRef.current && suggestedExpanded && override !== null) {
    setOverride(null);
  }
  prevSuggestedRef.current = suggestedExpanded;

  const expanded = override ?? suggestedExpanded;

  const toggle = useCallback(() => {
    setOverride(prev => {
      const baseline = prev ?? suggestedExpanded;
      return !baseline;
    });
  }, [suggestedExpanded]);

  return { expanded, toggle };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/ui/domains/work-orders/use-collapse-state.test.ts`
Expected: 全部 3 个测试通过。

- [ ] **Step 5: 提交**

```bash
git add src/ui/domains/work-orders/use-collapse-state.ts src/ui/domains/work-orders/use-collapse-state.test.ts
git commit -m "feat(work-orders): add useCollapseState hook with auto-expand on rows 0->1"
```

---

## Task 4：修改 selector — 加入 `displayPhase`、过滤 hidden、计算 `suggestedExpanded`

**Files:**
- Test: `src/ui/domains/work-orders/work-order.selectors.test.ts`
- Modify: `src/ui/domains/work-orders/work-order.selectors.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/ui/domains/work-orders/work-order.selectors.test.ts`：

```ts
/**
 * @file work-order.selectors.test.ts
 * @description selectWorkOrderBoard 测试 — 验证 displayPhase 派生、hidden 过滤、suggestedExpanded
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import { describe, expect, it } from 'vitest';
import type { EngineSnapshot, UiState, WorkOrderNode } from '../../kernel/ui-types';
import { selectWorkOrderBoard } from './work-order.selectors';
import type { CompletionTrackerState } from './use-completion-tracker';

/** 构造空但合法的快照 */
function makeSnapshot(orders: WorkOrderNode[]): EngineSnapshot {
  const byId: Record<string, WorkOrderNode> = {};
  for (const o of orders) byId[o.id] = o;
  return {
    workOrders: { list: orders, byId },
  } as unknown as EngineSnapshot;
}

function makeOrder(id: string, status: WorkOrderNode['status'], priority = 0): WorkOrderNode {
  return {
    id,
    title: id,
    sourceKind: 'map',
    orderKind: 'cut',
    priorityIndex: priority,
    status,
    blocked: false,
    totalItemCount: 1,
    doneItemCount: status === 'done' ? 1 : 0,
    activeWorkerCount: 0,
    items: [],
  };
}

const emptyUi = { inspectorTargetId: null } as unknown as UiState;
const emptyCompletion: CompletionTrackerState = {
  completingDoneAt: new Map(),
  exitingIds: new Set(),
  hiddenIds: new Set(),
};

describe('selectWorkOrderBoard', () => {
  it('marks displayPhase=normal for active orders', () => {
    const vm = selectWorkOrderBoard(
      makeSnapshot([makeOrder('a', 'active')]),
      emptyUi,
      emptyCompletion,
    );
    expect(vm.rows).toHaveLength(1);
    expect(vm.rows[0].displayPhase).toBe('normal');
    expect(vm.suggestedExpanded).toBe(true);
  });

  it('marks displayPhase=completing for done orders in completingDoneAt', () => {
    const completion: CompletionTrackerState = {
      completingDoneAt: new Map([['a', 1000]]),
      exitingIds: new Set(),
      hiddenIds: new Set(),
    };
    const vm = selectWorkOrderBoard(
      makeSnapshot([makeOrder('a', 'done')]),
      emptyUi,
      completion,
    );
    expect(vm.rows[0].displayPhase).toBe('completing');
  });

  it('marks displayPhase=exiting when id in exitingIds', () => {
    const completion: CompletionTrackerState = {
      completingDoneAt: new Map([['a', 1000]]),
      exitingIds: new Set(['a']),
      hiddenIds: new Set(),
    };
    const vm = selectWorkOrderBoard(
      makeSnapshot([makeOrder('a', 'done')]),
      emptyUi,
      completion,
    );
    expect(vm.rows[0].displayPhase).toBe('exiting');
  });

  it('filters out rows whose id is in hiddenIds', () => {
    const completion: CompletionTrackerState = {
      completingDoneAt: new Map(),
      exitingIds: new Set(),
      hiddenIds: new Set(['a']),
    };
    const vm = selectWorkOrderBoard(
      makeSnapshot([makeOrder('a', 'done'), makeOrder('b', 'active')]),
      emptyUi,
      completion,
    );
    expect(vm.rows.map(r => r.id)).toEqual(['b']);
  });

  it('suggestedExpanded reflects post-filter row count', () => {
    const completion: CompletionTrackerState = {
      completingDoneAt: new Map(),
      exitingIds: new Set(),
      hiddenIds: new Set(['a']),
    };
    const vm = selectWorkOrderBoard(
      makeSnapshot([makeOrder('a', 'done')]),
      emptyUi,
      completion,
    );
    expect(vm.rows).toHaveLength(0);
    expect(vm.suggestedExpanded).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/ui/domains/work-orders/work-order.selectors.test.ts`
Expected: FAIL，selector 缺少第三个参数。

- [ ] **Step 3: 修改 selector 签名与实现**

替换 `src/ui/domains/work-orders/work-order.selectors.ts` 中的 `toRow` 与 `selectWorkOrderBoard`，最终内容：

```ts
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
```

- [ ] **Step 4: 跑 selector 测试确认通过**

Run: `npx vitest run src/ui/domains/work-orders/work-order.selectors.test.ts`
Expected: 全部 5 个测试通过。

- [ ] **Step 5: 提交**

```bash
git add src/ui/domains/work-orders/work-order.selectors.ts src/ui/domains/work-orders/work-order.selectors.test.ts
git commit -m "feat(work-orders): selector derives displayPhase, filters hidden, suggests expanded"
```

---

## Task 5：修改 `WorkOrderBoard` 组件 — 标题条折叠 + 行 displayPhase class

**Files:**
- Modify: `src/ui/domains/work-orders/components/work-order-board.tsx`
- Modify: `src/ui/domains/work-orders/components/work-order-board.test.tsx`

- [ ] **Step 1: 扩展组件测试（先写新测试）**

替换 `src/ui/domains/work-orders/components/work-order-board.test.tsx`，最终内容：

```tsx
/**
 * @file work-order-board.test.tsx
 * @description WorkOrderBoard 组件测试 — 验证行渲染、选中态、折叠切换、完成态
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 */

import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { WorkOrderBoard } from './work-order-board';
import type { WorkOrderRow } from '../work-order.types';

function row(overrides: Partial<WorkOrderRow> = {}): WorkOrderRow {
  return {
    id: 'wo_1',
    title: '砍伐 5 棵树',
    sourceKind: 'map',
    priorityIndex: 0,
    progressLabel: '0 / 5',
    activeWorkerLabel: '2 人',
    blocked: false,
    status: 'active',
    displayPhase: 'normal',
    ...overrides,
  };
}

describe('WorkOrderBoard', () => {
  it('renders rows and dispatches pause / cancel actions', () => {
    const onPause = vi.fn();
    const onCancel = vi.fn();
    render(
      <WorkOrderBoard
        rows={[row()]}
        selectedOrderId="wo_1"
        expanded={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onPause={onPause}
        onResume={vi.fn()}
        onCancel={onCancel}
        detail={{
          id: 'wo_1',
          title: '砍伐 5 棵树',
          items: [{ id: 'woi_1', status: 'working', blockedReason: null, currentStage: 'cutting', claimedByPawnId: 'pawn_1' }],
        }}
      />,
    );
    expect(screen.getByText('砍伐 5 棵树')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '暂停' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onPause).toHaveBeenCalledWith('wo_1');
    expect(onCancel).toHaveBeenCalledWith('wo_1');
  });

  it('hides list and detail when collapsed', () => {
    render(
      <WorkOrderBoard
        rows={[row()]}
        selectedOrderId={null}
        expanded={false}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        detail={null}
      />,
    );
    // 标题条仍可见
    expect(screen.getByRole('button', { name: /工作订单/ })).toBeInTheDocument();
    // 列表不渲染
    expect(screen.queryByText('砍伐 5 棵树')).toBeNull();
  });

  it('header button toggles via onToggle', () => {
    const onToggle = vi.fn();
    render(
      <WorkOrderBoard
        rows={[]}
        selectedOrderId={null}
        expanded={false}
        onToggle={onToggle}
        onSelect={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        detail={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /工作订单/ }));
    expect(onToggle).toHaveBeenCalled();
  });

  it('renders ✓ and applies completing class for displayPhase=completing', () => {
    render(
      <WorkOrderBoard
        rows={[row({ displayPhase: 'completing' })]}
        selectedOrderId={null}
        expanded={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        detail={null}
      />,
    );
    const li = screen.getByText('砍伐 5 棵树').closest('li');
    expect(li?.className).toContain('work-order-row--completing');
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('applies exiting class for displayPhase=exiting', () => {
    render(
      <WorkOrderBoard
        rows={[row({ displayPhase: 'exiting' })]}
        selectedOrderId={null}
        expanded={true}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        detail={null}
      />,
    );
    const li = screen.getByText('砍伐 5 棵树').closest('li');
    expect(li?.className).toContain('work-order-row--exiting');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/ui/domains/work-orders/components/work-order-board.test.tsx`
Expected: FAIL，组件不接受 `expanded` / `onToggle`，且不会渲染 ✓。

- [ ] **Step 3: 修改 `WorkOrderBoard` 组件**

替换 `src/ui/domains/work-orders/components/work-order-board.tsx`，最终内容：

```tsx
/**
 * @file work-order-board.tsx
 * @description 工作订单看板 — 左侧面板，标题条始终可见，列表区可折叠
 * @dependencies work-order.types — WorkOrderRow, WorkOrderDetailViewModel；
 *               work-order-detail — 详情子面板
 * @part-of ui/domains/work-orders — 工作订单 UI 领域
 *
 * 设计要点：
 * - 标题条 "工作订单" 始终可见，前置雪佛龙 ▸/▾，整条可点击触发 onToggle
 * - 列表区根据 expanded 决定渲染（收起态完全不渲染列表与详情）
 * - 行内显示：优先级编号 + 标题 + 来源/进度/工人/状态徽章
 * - 行根据 displayPhase 加 class：
 *   - 'completing' → work-order-row--completing（显示 ✓ + 标题划线）
 *   - 'exiting'    → work-order-row--exiting（淡出 + 高度收 0）
 */

import type { WorkOrderRow, WorkOrderDetailViewModel } from '../work-order.types';
import { WorkOrderDetail } from './work-order-detail';

/** WorkOrderBoard 组件属性 */
interface WorkOrderBoardProps {
  /** 订单行列表 */
  rows: WorkOrderRow[];
  /** 当前选中订单 ID（无选中则 null） */
  selectedOrderId: string | null;
  /** 是否展开（标题条始终显示，列表区受此控制） */
  expanded: boolean;
  /** 切换展开/收起 — 标题条点击回调 */
  onToggle: () => void;
  /** 选中订单详情视图模型（无选中则 null） */
  detail: WorkOrderDetailViewModel | null;
  /** 选中行回调 */
  onSelect: (orderId: string) => void;
  /** 暂停订单回调 */
  onPause: (orderId: string) => void;
  /** 继续订单回调 */
  onResume: (orderId: string) => void;
  /** 取消订单回调 */
  onCancel: (orderId: string) => void;
}

/** 订单整体状态对应的中文短名 — 用于状态徽章文案 */
const ORDER_STATUS_LABEL: Record<WorkOrderRow['status'], string> = {
  pending: '待开始',
  active: '进行中',
  paused: '已暂停',
  done: '已完成',
  cancelled: '已取消',
};

/** 来源对应的中文短名 — 用于来源徽章文案 */
const SOURCE_LABEL: Record<WorkOrderRow['sourceKind'], string> = {
  map: '地图',
  result: '工作台',
};

/**
 * 单行订单 — 命中点击区为整个 button，操作按钮通过 stopPropagation 防止冒泡
 */
function WorkOrderRowItem({
  row,
  isSelected,
  onSelect,
  onPause,
  onResume,
  onCancel,
}: {
  row: WorkOrderRow;
  isSelected: boolean;
  onSelect: (orderId: string) => void;
  onPause: (orderId: string) => void;
  onResume: (orderId: string) => void;
  onCancel: (orderId: string) => void;
}) {
  // 暂停按钮：当订单为 paused 状态时切换为继续按钮
  const isPaused = row.status === 'paused';
  // 终态订单（done/cancelled）禁用所有操作
  const isTerminal = row.status === 'done' || row.status === 'cancelled';

  // 状态徽章颜色：blocked > status 派生
  const statusToken = row.blocked && !isTerminal ? 'blocked' : row.status;

  // displayPhase 派生 class — completing 显示 ✓ + 划线；exiting 淡出 + 收高
  const phaseClass = row.displayPhase === 'completing'
    ? 'work-order-row--completing'
    : row.displayPhase === 'exiting'
      ? 'work-order-row--exiting'
      : '';

  return (
    <li
      class={`work-order-row ${isSelected ? 'is-selected' : ''} ${phaseClass}`}
      data-status={row.status}
    >
      <button
        type="button"
        class="work-order-row__main"
        onClick={() => onSelect(row.id)}
      >
        <span class="work-order-row__handle" aria-hidden="true">⋮⋮</span>
        <span class="work-order-row__priority">
          {row.displayPhase === 'completing' ? '✓' : row.priorityIndex + 1}
        </span>
        <div class="work-order-row__body">
          <div class="work-order-row__title">{row.title}</div>
          <div class="work-order-row__meta">
            <span class={`work-order-pill work-order-pill--source-${row.sourceKind}`}>
              {SOURCE_LABEL[row.sourceKind]}
            </span>
            <span class={`work-order-pill work-order-pill--status-${statusToken}`}>
              {row.blocked && !isTerminal ? '阻塞' : ORDER_STATUS_LABEL[row.status]}
            </span>
            <span class="work-order-row__progress">{row.progressLabel}</span>
            <span class="work-order-row__workers">{row.activeWorkerLabel}</span>
          </div>
        </div>
      </button>
      <div class="work-order-row__actions">
        {isPaused ? (
          <button
            type="button"
            class="work-order-row__btn"
            disabled={isTerminal}
            onClick={(e) => { e.stopPropagation(); onResume(row.id); }}
          >
            继续
          </button>
        ) : (
          <button
            type="button"
            class="work-order-row__btn"
            disabled={isTerminal}
            onClick={(e) => { e.stopPropagation(); onPause(row.id); }}
          >
            暂停
          </button>
        )}
        <button
          type="button"
          class="work-order-row__btn work-order-row__btn--danger"
          disabled={isTerminal}
          onClick={(e) => { e.stopPropagation(); onCancel(row.id); }}
        >
          取消
        </button>
      </div>
    </li>
  );
}

/**
 * 工作订单看板 — 左侧 ui-panel
 *
 * 行列表渲染顺序由 selector 给出（按 priorityIndex 升序）。
 * 标题条始终可见，列表区根据 expanded 决定渲染。
 * 选中订单后在底部嵌入 WorkOrderDetail 子面板（仅 expanded 时）。
 */
export function WorkOrderBoard({
  rows,
  selectedOrderId,
  expanded,
  onToggle,
  detail,
  onSelect,
  onPause,
  onResume,
  onCancel,
}: WorkOrderBoardProps) {
  return (
    <div class="work-order-board ui-panel" data-testid="work-order-board">
      <button
        type="button"
        class={`work-order-board__header ${expanded ? 'is-expanded' : ''}`}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span class="work-order-board__chevron" aria-hidden="true">▾</span>
        <span>工作订单</span>
        {rows.length > 0 && (
          <span class="work-order-board__count">{rows.length}</span>
        )}
      </button>
      <div class={`work-order-board__body ${expanded ? 'is-expanded' : ''}`}>
        {rows.length === 0 ? (
          <div class="work-order-board__empty">当前没有订单</div>
        ) : (
          <ul class="work-order-board__list">
            {rows.map(row => (
              <WorkOrderRowItem
                key={row.id}
                row={row}
                isSelected={row.id === selectedOrderId}
                onSelect={onSelect}
                onPause={onPause}
                onResume={onResume}
                onCancel={onCancel}
              />
            ))}
          </ul>
        )}
        <WorkOrderDetail detail={detail} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 跑组件测试确认通过**

Run: `npx vitest run src/ui/domains/work-orders/components/work-order-board.test.tsx`
Expected: 全部 5 个测试通过。

- [ ] **Step 5: 提交**

```bash
git add src/ui/domains/work-orders/components/work-order-board.tsx src/ui/domains/work-orders/components/work-order-board.test.tsx
git commit -m "feat(work-orders): collapsible header, displayPhase class, completion checkmark"
```

---

## Task 6：在 `app-shell.tsx` 串联 hook 与 selector

**Files:**
- Modify: `src/ui/app/app-shell.tsx`

- [ ] **Step 1: 修改 `app-shell.tsx`**

调用顺序：先 `useCompletionTracker` 拿 completion → 喂给 selector → 再用 selector 输出的 `suggestedExpanded` 喂 `useCollapseState`。

修改导入与正文部分：

```tsx
import { selectWorkOrderBoard } from '../domains/work-orders/work-order.selectors';
import { WorkOrderBoard } from '../domains/work-orders/components/work-order-board';
import { useCompletionTracker } from '../domains/work-orders/use-completion-tracker';
import { useCollapseState } from '../domains/work-orders/use-collapse-state';
```

并把原来：

```tsx
  const workOrderBoard = selectWorkOrderBoard(snapshot, uiState);
```

替换为：

```tsx
  // 工单看板 — 先跟踪完成淡出窗口，再投影视图模型，再决定折叠状态
  const completion = useCompletionTracker(snapshot.workOrders.list);
  const workOrderBoard = selectWorkOrderBoard(snapshot, uiState, completion);
  const collapse = useCollapseState(workOrderBoard.suggestedExpanded);
```

并把 `<WorkOrderBoard ... />` 中加入 `expanded` 与 `onToggle`：

```tsx
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
```

- [ ] **Step 2: 跑类型检查与已有 app-shell 测试**

Run: `npx tsc --noEmit && npx vitest run src/ui/app/app-shell.test.tsx`
Expected: 类型通过，app-shell 测试通过（如有失败查看是否需要补 expanded/onToggle 的占位 props，按需修复）。

- [ ] **Step 3: 修复 selector 调用签名变更引发的其他失败**

Run: `npx vitest run` 全量
Expected: 唯一会失败的应该是各 `*selectors.test.ts` 中调用 `selectWorkOrderBoard` 旧签名的测试。从输出确认。如果有，按 Task 4 同款 `emptyCompletion` 补第三个参数即可（不要改动测试逻辑）。

如有失败的 selectors 测试需修复，例如：

```ts
const emptyCompletion = { completingDoneAt: new Map(), exitingIds: new Set(), hiddenIds: new Set() };
selectWorkOrderBoard(snapshot, uiState, emptyCompletion);
```

修复完后再跑 `npx vitest run` 直到全绿。

- [ ] **Step 4: 提交**

```bash
git add src/ui/app/app-shell.tsx
git commit -m "feat(work-orders): wire completion tracker + collapse state into app shell"
```

如有 selectors 测试调整：

```bash
git add src/ui/
git commit -m "test: update selector callers for new completion arg"
```

---

## Task 7：CSS — 标题条 / 折叠 / 完成态 / 进入 / 退出 动效

**Files:**
- Modify: `src/ui/styles/app.css`

- [ ] **Step 1: 替换 `.work-order-board` 段（646 行附近的 `── Work Order Board ──` 注释起，到 `── Work Order Pill ──` 之前）**

定位现有段：从 `/* ── Work Order Board ── */` 开始，到 `.work-order-row__btn:disabled { ... }` 块结束（约 821 行）。把面板与列表的位置布局保留，但增加：标题条按钮、列表 body 折叠容器、行 displayPhase class、prefers-reduced-motion 退化。

具体替换内容（仅 work-order-board / work-order-row 相关样式部分，保留所有原有规则中尚需的内容）：

```css
/* ── Work Order Board ── */

.work-order-board {
  position: absolute;
  left: 10px;
  top: 250px;
  width: 320px;
  max-height: calc(100vh - 320px);
  overflow-y: auto;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
}

/* 标题条按钮 — 始终可见 */
.work-order-board__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: none;
  border: none;
  text-align: left;
  width: 100%;
  font-family: var(--font-family);
  font-size: var(--font-size);
  font-weight: bold;
  color: var(--text-color);
  cursor: pointer;
  border-bottom: 1px solid var(--panel-border);
  transition: background 120ms ease;
}

.work-order-board__header:hover {
  background: rgba(255, 255, 255, 0.04);
}

.work-order-board__chevron {
  display: inline-block;
  width: 10px;
  font-size: 10px;
  color: var(--text-muted);
  transform: rotate(-90deg);
  transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.work-order-board__header.is-expanded .work-order-board__chevron {
  transform: rotate(0deg);
}

.work-order-board__count {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* 列表 + detail 容器 — 受 expanded 控制的折叠区 */
.work-order-board__body {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition:
    max-height 200ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.work-order-board__body.is-expanded {
  max-height: 60vh;
  opacity: 1;
}

.work-order-board__empty {
  padding: 18px 4px;
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
}

.work-order-board__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 单行容器：相对定位以承载 selected 左侧强调条 */
.work-order-row {
  position: relative;
  display: flex;
  align-items: stretch;
  border-radius: 4px;
  max-height: 80px; /* 用于退出动画收 0 */
  opacity: 1;
  transition:
    background 120ms ease,
    transform 120ms ease,
    opacity 240ms cubic-bezier(0.2, 0.8, 0.2, 1),
    max-height 240ms cubic-bezier(0.2, 0.8, 0.2, 1),
    color 200ms ease;
  /* 进入动画：通过 animation 单独触发 */
  animation: wo-row-enter 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes wo-row-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

.work-order-row:hover {
  background: rgba(255, 255, 255, 0.04);
  transform: translateX(1px);
}

/* 选中行：左侧 3px accent 条 + 浅色 accent 背景 */
.work-order-row.is-selected {
  background: rgba(74, 144, 217, 0.12);
}

.work-order-row.is-selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  border-radius: 2px;
  background: var(--accent);
}

/* 完成态：标题划线 + 整行灰化 */
.work-order-row--completing {
  color: var(--text-muted);
}

.work-order-row--completing .work-order-row__title {
  position: relative;
  color: var(--text-muted);
}

.work-order-row--completing .work-order-row__title::after {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  height: 1px;
  width: 100%;
  background: currentColor;
  transform-origin: left center;
  animation: wo-row-strike 200ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

@keyframes wo-row-strike {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.work-order-row--completing .work-order-row__priority {
  color: #2e7d32;
  background: rgba(46, 125, 50, 0.12);
}

/* 退出态：淡出 + 高度收 0 */
.work-order-row--exiting {
  opacity: 0;
  max-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  pointer-events: none;
}

.work-order-row__main {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  background: none;
  border: none;
  text-align: left;
  font-family: var(--font-family);
  color: inherit;
  cursor: pointer;
  min-width: 0; /* 允许内部 title 截断 */
}

.work-order-row__handle {
  align-self: center;
  width: 10px;
  color: var(--text-muted);
  font-size: 10px;
  letter-spacing: -1px;
  opacity: 0;
  transition: opacity 120ms ease;
  user-select: none;
}

.work-order-row:hover .work-order-row__handle,
.work-order-row.is-selected .work-order-row__handle {
  opacity: 0.5;
}

.work-order-row__priority {
  align-self: center;
  min-width: 18px;
  padding: 2px 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
  transition: background 200ms ease, color 200ms ease;
}

/* prefers-reduced-motion: 关闭所有动画与过渡 */
@media (prefers-reduced-motion: reduce) {
  .work-order-board__chevron,
  .work-order-board__body,
  .work-order-row,
  .work-order-row__priority {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
  }
  .work-order-row--completing .work-order-row__title::after {
    animation: none !important;
    transform: scaleX(1);
  }
}
```

注意：
- 保留同段后续 `.work-order-row__body`、`.work-order-row__title`、`.work-order-row__meta` 等子样式不动（在被替换段之后已存在的 752 → 822 行附近）。仅替换上述涉及到的部分。
- 如果测试中有 `data-testid="work-order-board"` 则不要改 root class 名。

- [ ] **Step 2: 视觉手测**

启动 dev：

Run: `npm run dev`
预期：
- 初始无订单 → 看板只剩标题条 `▸ 工作订单`
- 框选若干树发出砍伐订单 → 标题条变 `▾ 工作订单 (N)`，列表区 200ms 内淡入展开
- 砍完一个订单 → 该行优先级数字变 ✓，标题被划线，2 秒后整行淡出收起
- 全部完成 → 列表清空 → 看板自动收起为标题条
- 点标题条可手动展开/收起（在有订单期间）
- 在 OS 偏好中开"减少动画" → 上述变化变为瞬时切换

如果手测失败，针对具体问题回到 Task 2/3/4/5/7 修复。

- [ ] **Step 3: 跑全量测试与类型检查**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全绿。

- [ ] **Step 4: 提交**

```bash
git add src/ui/styles/app.css
git commit -m "feat(work-orders): collapse + completion + enter/exit animations"
```

---

## Task 8：更新 memory `project_work_orders.md`

**Files:**
- Modify: `.claude/memory/project_work_orders.md`

- [ ] **Step 1: 在 "How to apply" 段后追加 UI 完成窗口契约**

在 `.claude/memory/project_work_orders.md` 的 "How to apply" 列表末尾新增一条：

```markdown
- UI 层不会永久显示终态订单：done 在 2000ms 高亮后退出，cancelled 直接退出（淡出 240ms）。完成淡出窗口由 `src/ui/domains/work-orders/use-completion-tracker.ts` 维护，对数据层 `WorkOrderStore` 不产生任何写操作。新场景测试如需断言"订单完成时机"，应基于数据层 `status === 'done'`，而非 UI 行可见性。
```

- [ ] **Step 2: 提交**

```bash
git add .claude/memory/project_work_orders.md
git commit -m "chore(memory): document UI completion fade-out window contract"
```

---

## Self-Review

- [x] **Spec coverage**：
  - 自动展开/收起 → Task 3 / 5 / 7
  - 用户可手动切换 + rows 0→1 清覆盖 → Task 3
  - 完成 → 高亮 + 划线 → 2s → 淡出 → Task 2 / 4 / 5 / 7
  - cancelled 直接退出 → Task 2 / 4
  - 行进入动效 → Task 7
  - prefers-reduced-motion 退化 → Task 7
  - selector 纯函数 → Task 4
  - 不修改 world / features → 全程未涉及
  - memory 更新 → Task 8

- [x] **Placeholder scan**：每步都给出了实际代码或具体命令。

- [x] **Type consistency**：`displayPhase`、`suggestedExpanded`、`CompletionTrackerState`、`useCollapseState`、`useCompletionTracker`、CSS class `work-order-row--completing` / `work-order-row--exiting` / `work-order-board__header` / `work-order-board__body` / `work-order-board__chevron` / `work-order-board__count` 在 Task 1-7 中保持一致。
