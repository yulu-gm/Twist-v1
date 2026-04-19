---
name: project-work-orders
description: 工作订单系统是玩家指令的统一入口，AI 只从订单取活（v0.0.1 起的强制契约）
type: project
---

自 `v0.0.1`（2026-04-18）起，**WorkOrder 是玩家所有"做什么"指令的唯一控制单位**，AI 只从订单取活，不再直接扫描裸地图标记。

**契约要点：**
- 玩家入口收敛为两个命令：`create_map_work_order`（地图操作：拖拽框选、放置蓝图）、`create_result_work_order`（工坊产出请求）。
- `create_map_work_order` 处理器在创建时**物化** Designation/Blueprint（`cut`/`harvest`/`mine`/`build`），并把 `workOrderId` / `workOrderItemId` 回填到 artifact 与 `item.artifactId`，AI 通过此双向链路溯源。
- 全局优先级：`map.workOrders.list()` 按 `priorityIndex` 升序，evaluator 严格按顺序扫描——高优先订单始终压过低优先，距离只是同订单内的 tie-breaker。
- 项目入口：`src/features/work-orders/`（types/store/commands/system）；evaluator 改造点：`src/features/ai/work-evaluators/{designation,construction}.evaluator.ts`；输入层：`src/adapter/input/input-handler.ts`；UI 看板：`src/ui/domains/work-orders/`。

**Why:** 2026-04-17 spec `docs/superpowers/specs/2026-04-17-player-work-order-command-design.md` 明确要求把分散的 designation 收敛成"订单"，让玩家通过订单看板理解 colony 在做什么，并支持全局优先级、暂停、取消。

**How to apply:**
- 新增玩家可下达的指令时，**不要**新建 designation 命令，而是扩展 `orderKind` 并在 `materializeMapWorkOrderItems` 中加新分支。
- 新写 AI evaluator 时，先 `for (const order of map.workOrders.list())` 严格按序扫描，命中即返；不要回退到全图扫描裸标记。
- Job 完成时必须把 `item.status` 写回 `done`（见 `work.handler.ts`、`construction.system.ts`）。
- 新场景测试断言订单进度时使用 `result.finalSnapshot.workOrders.byTitle[<title>]`（auto-id `wo_<n>` 不稳定）。
- UI 层不会永久显示终态订单：done 在 2000ms 高亮后退出，cancelled 直接退出（淡出 240ms）。完成淡出窗口由 `src/ui/domains/work-orders/use-completion-tracker.ts` 维护，对数据层 `WorkOrderStore` 不产生任何写操作。新场景测试如需断言"订单完成时机"，应基于数据层 `status === 'done'`，而非 UI 行可见性。
