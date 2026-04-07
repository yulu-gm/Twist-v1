# 审计报告: src/game/work/work-types.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `WorkItemStatus` 仅为 `open` | `claimed` | `completed`，缺少与策划一致的「失败」终态；同文件内 `WorkOrderStatus` 已包含 `failed`，两套模型语义不一致。
- [依据]: 见 `oh-gen-doc/工作系统.yaml` 中 `工作状态` → `失败`（工作执行失败如目标消失）。

- [指控]: `oh-code-design/工作系统.yaml` 的 `需求覆盖` 明确覆盖拾取、搬运、伐木、建造四类；`WorkOrderKind` 与之对应，但 `WorkItemKind` 另含 `deconstruct-obstacle`、`mine-stone`。若业务仍需后两类进入统一「工作单」抽象，则当前 `WorkOrder`/`WorkOrderKind` 未体现这两类，存在新模型侧缺口（或需在文档中显式承认扩展类型范围）。
- [依据]: 见 `oh-code-design/工作系统.yaml` 的 `需求覆盖` 与 `核心数据` → `工作单` → `工作类型`。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 第 25 行注释写明 `WorkOrder` 与遗留 `WorkItemSnapshot`「并存」，类型层长期双轨，属于技术债显性标记；未见 `mock`/`TODO` 等临时桩代码。
- [影响]: 调用方易混用 `id` 与 `workId`、`anchorCell` 与 `targetCell`、`claimedBy` 与 `claimedByPawnId`，测试与调度逻辑可能重复维护两套字段约定。

## 3. 架构违规 (Architecture Violations)

- [指控]: `oh-code-design/工作系统.yaml` 在 `核心数据` 中只定义一种「工作单」及其关键字段（工作标识、类型、状态、目标实体、目标位置、发起原因、优先级等）；本文件同时导出 `WorkItemSnapshot` 与 `WorkOrder` 两套顶层结构，领域边界上形成并列模型，与「统一工作候选与执行上下文」的 `目标` 表述存在张力。
- [依据]: 见 `oh-code-design/工作系统.yaml` 的 `目标`（为行为系统提供统一工作候选）与 `核心数据` → `工作单`。

- [指控]: `WorkStep` 的字段（步骤类型、前置条件、成功/失败结果）与设计中「工作步骤」一致，声明式扩展方向符合 `扩展点`；但该类型与 `WorkItemSnapshot` 无直接关联，仅挂在 `WorkOrder` 上，加剧「步骤模型只服务新轨、旧轨无同构步骤」的分裂感。
- [依据]: 见 `oh-code-design/工作系统.yaml` 的 `核心数据` → `工作步骤` 与 `扩展点`。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0188]: 在迁移完成前于内部约定：`WorkItemSnapshot` 的失败是否仅用 `failureCount` + 重开表示，若需与策划「失败」状态对齐，应增补状态或文档说明映射关系。
- [行动点 #0189]: 制定弃用路线：统一标识符、单元格字段名与认领字段名，或对外只导出一种 `WorkOrder`（及关联 `WorkStep`），将 `WorkItemSnapshot` 收缩为适配层私有类型。
- [行动点 #0190]: 若保留 `deconstruct-obstacle`、`mine-stone`，在 `oh-gen-doc`/`oh-code-design` 中补充对应工作类型与队列规则，或在代码注释中引用已更新的文档条款，避免审计依据悬空。