# 工单看板 UX 改造设计（自动收起 + 完成动效）

- **日期**：2026-04-19
- **分支**：`feat/player-work-orders`
- **范围**：仅 `src/ui/domains/work-orders/` 与 `src/ui/styles/app.css` 的工单段。不修改 `world` / `features/work-orders` / snapshot reader。
- **关联记忆**：`.claude/memory/project_work_orders.md`（v0.0.1 起 WorkOrder 是玩家指令的唯一控制单位）

## 1 · 目标

在 `feat/player-work-orders` 分支已有的工单看板基础上，调整其呈现逻辑，使工单流转的视觉体验更明确、对屏幕空间更友好：

- 没有订单时面板自动收起，仅留标题条；用户也能手动展开/收起。
- 订单完成时给出明确的视觉反馈（打勾 + 划线），保持约 2 秒后从看板淡出。
- 订单进入、订单完成、面板展开/收起都有动效，形成一致的动效语言。
- 数据层 `WorkOrderStore` 保留所有订单（含 `done` / `cancelled`），UI 自行决定展示窗口与隐藏。

非目标：

- 不改变工单栏在屏幕上的位置（继续在左侧）。
- 不改变 Object Inspector、ToolModeBar 等其他面板。
- 不引入新的玩家指令、不修改 WorkOrder 数据契约。

## 2 · 行为规则

### 2.1 面板展开 / 收起

- 标题条 `工作订单` 始终可见，前置雪佛龙 `▸` / `▾` 指示当前状态，整条可点击切换。
- **自动建议状态**：可显示订单数 > 0 → 建议展开；= 0 → 建议收起。
- **用户覆盖**：用户点击标题条切换后，覆盖自动建议；当 rows 计数从 0 跨越到 ≥1 时，覆盖被清空（恢复"自动展开"），让新订单一定能被看到。
- 收起态不渲染列表区，也不渲染内嵌的 `WorkOrderDetail` 子面板。

### 2.2 订单的 UI 生命周期

数据层 `status` 字段不变，UI 派生新的 `displayPhase`：

| 数据层 status | UI displayPhase | 渲染行为 |
|---|---|---|
| `pending` / `active` / `paused` | `normal` | 现有外观 |
| `done` | `completing`（持续 2000ms）→ `exiting`（240ms）→ 不再渲染 | 行内显示 ✓ + 标题划线 + 灰化 |
| `cancelled` | 不进入完成展示窗口，直接 `exiting` 一次后不再渲染 | 静默退出 |

「完成展示」的窗口由 UI 层维护一个 `Map<orderId, doneAtMs>` 记录每个 done 订单首次出现的时刻；超过 2000ms 后把该 ID 标 `exiting`，再过 240ms 加入 `hiddenIds`，selector 据此过滤掉该行。

## 3 · 架构与文件落点

所有改动收敛在 `src/ui/domains/work-orders/`，selector 仍是纯函数，时间状态由 hook 管理。

### 3.1 新增 / 修改文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `work-order.types.ts` | 修改 | `WorkOrderRow` 增加 `displayPhase: 'normal' \| 'completing' \| 'exiting'`；`WorkOrderBoardViewModel` 增加 `suggestedExpanded: boolean` |
| `work-order.selectors.ts` | 修改 | `selectWorkOrderBoard(snapshot, uiState, completionState)` 增加 `completionState = { completingDoneAt: Map<string, number>, exitingIds: Set<string>, hiddenIds: Set<string>, now: number }`，据此派生 `displayPhase`、过滤 `hiddenIds`、计算 `suggestedExpanded = visibleRows.length > 0` |
| `use-collapse-state.ts` | 新增 | hook：管理 `userOverride: boolean \| null`；当传入的 `suggestedExpanded` 从 false 跨越到 true 时清空 override；返回 `{ expanded, toggle }` |
| `use-completion-tracker.ts` | 新增 | hook：观察 rows 中新出现的 `status='done'` 订单，记录 `doneAtMs`；用 `requestAnimationFrame` + 时间戳推进，2000ms 后标 `exiting`，再 240ms 后加入 `hiddenIds`；返回 `completionState` 给 selector |
| `components/work-order-board.tsx` | 修改 | 拆出 `WorkOrderBoardHeader`（标题条按钮 + 雪佛龙）；列表区根据 `expanded` 展开收起；`<li>` 根据 `displayPhase` 加 class（`wo-row--entering` / `wo-row--completing` / `wo-row--exiting`） |
| `components/work-order-board.tsx` 内 `WorkOrderRowItem` | 修改 | `displayPhase === 'completing'` 时优先级数字位置渲染 ✓；为标题加 `wo-row__title` class 承载划线动效 |
| `app.css`（work-order 段） | 修改 | 新增 keyframes / class：`wo-row--entering` (opacity 0→1)、`wo-row--exiting` (opacity + max-height + padding 收 0)、`wo-row__title` 划线伪元素、`wo-board__list` 展开/收起 max-height + opacity；`prefers-reduced-motion: reduce` 下全部置 0 |

### 3.2 调用流

```
AppShell
  └── useCompletionTracker(rawRows, now)  → completionState
  └── selectWorkOrderBoard(snapshot, uiState, completionState)  → { rows(已附 displayPhase, 已过滤 hidden), suggestedExpanded, ... }
  └── useCollapseState(suggestedExpanded)  → { expanded, toggle }
  └── <WorkOrderBoard expanded={expanded} onToggle={toggle} ... />
```

`useCompletionTracker` 接收"原始 rows"（未过滤 hidden 的版本），便于观察新出现的 done。可以让 selector 同时输出"未过滤 rows"和"过滤后 rows"，或者让 hook 直接读 `snapshot.workOrders.list` 自己最小投影 — 实施时择一。

### 3.3 不在此次范围内

- WorkOrderStore 是否清理 done 订单（数据层保留契约不变）。
- WorkOrderDetail 子面板的内部样式（仅根据 expanded 跟随显隐）。
- 与 Object Inspector 的位置交互。

## 4 · 动效规格

统一缓动 `cubic-bezier(0.2, 0.8, 0.2, 1)`，与现有 `toast-in` 风格保持一致。

| 动效 | 触发 | 时长 | 实现 |
|---|---|---|---|
| 行进入 | 新订单首次出现在 rows | 200ms | `opacity: 0→1`；CSS class `wo-row--entering` 在 mount 后下一帧移除（用 `useLayoutEffect`） |
| 行完成态显示 | row.displayPhase 从 normal → completing | 即时 + 200ms 划线 | 优先级数字位置替换为 ✓；`wo-row__title` 伪元素 `::after` 宽度 0→100%（200ms）；整行 `color` 过渡到 `--text-muted` |
| 行退出 | row.displayPhase = exiting | 240ms | class `wo-row--exiting`：`opacity: 1→0` + `max-height: <某常量>→0` + `padding/margin→0` |
| 面板展开 | expanded false → true | 200ms | 列表容器 `max-height: 0 → 60vh` + `opacity: 0→1`；雪佛龙 rotate 0°→90° |
| 面板收起 | expanded true → false | 200ms | 反向 |

实现要点：

- 行退出采用 "keep for one render" 模式：tracker 把 `displayPhase` 标 `exiting` 后保留 240ms 再加入 `hiddenIds`，期间 CSS 完成收起动画。
- 面板展开/收起的 `max-height` 用 `60vh` 这种"足够大"的常量配合 `overflow: hidden`，避免测量真实高度。
- 全部动效在 `@media (prefers-reduced-motion: reduce)` 下退化为 0ms 直接切换。

## 5 · 测试策略

| 测试文件 | 覆盖 |
|---|---|
| `work-order.selectors.test.ts`（新增） | 给定 rows + completionState + now，断言 `displayPhase` 标记、`hiddenIds` 过滤、`suggestedExpanded` 派生值 |
| `use-collapse-state.test.ts`（新增） | rows 0→1 清空 override；rows ≥1 时手动 toggle 生效；rows 1→0→1 后 override 是否被清空 |
| `use-completion-tracker.test.ts`（新增） | vitest fake timers：done 出现立刻在 `completingDoneAt` 中；2000ms 后 ID 进入 `exitingIds`；再过 240ms 进入 `hiddenIds`；cancelled 出现时跳过 2000ms 直接进入 `exitingIds`；多个订单同时存在互不干扰 |
| `work-order-board.test.tsx`（扩展） | 收起态只渲染标题条；点击标题条切换 expanded；`displayPhase=completing` 时行渲染 ✓ + `wo-row__title` 加划线 class |

不测试 CSS 动画的视觉表现，留给手动验证。

## 6 · 风险与权衡

- **依赖 wall-clock `now`**：`useCompletionTracker` 用 `Date.now()` 推进 — 引擎暂停或速度变化不影响 UI 计时（这是有意的，UI 反馈应跟着真实时间走）。
- **覆盖语义**：用户手动收起后，rows 持续 ≥1 期间始终保持收起；只有 rows 跨越 0→1 时才"重新邀请展开"。这避免了"用户刚收起就被新订单弹开"的烦扰。
- **`max-height: 60vh` 常量**：足够覆盖列表，但理论上极端情况列表可能被裁切（已经会有 overflow-y 滚动条，所以问题不大）。
- **完成动效与 status='cancelled' 的差别**：cancelled 不展示完成态，避免"取消"被误读为"完成"。

## 7 · 实施提示

- 严格按现有 work-orders 域内组织代码，不外泄。
- 严格遵守项目规则：保留所有原有注释，新代码用中文注释、文件头 JSDoc 块。
- 不要为兼容旧行为留任何分支 — 完成态从无→有就是新增能力，不存在旧路径。
- 完成实施后，更新 `.claude/memory/project_work_orders.md`，把"UI 完成态淡出窗口"的契约补进去。
