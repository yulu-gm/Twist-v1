# 审计报告: src/game/work/work-registry.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `oh-code-design/工作系统.yaml` 模块「工作目录」职责写明「支持按类型、优先级、位置查询」。本文件提供 `getByKind`（类型）、`getByStatus`（状态）、`getByTarget`（目标实体），但**未提供按 `targetCell`（目标位置）或空间范围的位置查询**；也未提供任何按 `priority` 的查询或有序访问接口（优先级排序由 `work-scheduler.ts` 对 `Map` 全量遍历后完成，不在本注册表层体现「按优先级查询」能力）。
- [依据]: `oh-code-design/工作系统.yaml` 中「模块 → 工作目录 → 职责」第 33–34 行；`oh-gen-doc/工作系统.yaml`「工作队列」中「工作优先级 / 选择优先级最高的工作」与地图格移动相关描述，隐含调度需结合位置与优先级，而本文件未暴露位置维度查询。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。

## 3. 架构违规 (Architecture Violations)

- [指控]: 设计上「工作目录」应**统一保存**待执行、执行中、完成、失败的工作（`oh-code-design/工作系统.yaml`「工作目录」职责第 33 行及「核心数据 → 工作单」字段）。运行时代码中 `WorldCore.workItems`（`WorkItemSnapshot`）与 `WorkRegistry.orders`（`WorkOrder`）并存，本文件实现的注册表易与 `world-core` 工单存储形成**第二真相源**，与「单一工作目录」边界不一致。
- [依据]: `oh-code-design/工作系统.yaml`「工作目录」与「核心数据 → 工作单」；对照 `src/game/world-core-types.ts` 中 `workItems` 与全仓对 `workItems` 的广泛使用（grep 可见）。

- [指控]: 类型 `WorkRegistry` 声明为 `Readonly<{ orders: Map<...> }>`，但 `addWork` / `removeWork` 及外部对 `registry.orders.set` 的调用仍**可变**内部 `Map`；`Readonly` 仅浅层约束对象字面，未表达「目录不可变快照」语义，与只读类型名存在张力。
- [依据]: 本文件第 3–5、11–16 行；属实现与类型契约不一致（设计未逐字规定，但削弱模块边界可读性）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0178]: 补充按位置查询（例如按 `GridCoord` 精确匹配 `targetCell`，或按区域过滤），或在工作系统层书面约定「位置查询由地图索引服务承担」并同步修订 `oh-code-design` 中「工作目录」条款，避免设计与实现长期错位。
- [行动点 #0179]: 将「按优先级」能力收敛到工作目录 API（例如返回按 `priority` 排序的视图或专用查询），或明确文档化「优先级仅由 `work-scheduler` 全表扫描排序」为既定架构并收窄设计表述。
- [行动点 #0180]: 理清 `WorkRegistry` 与 `WorldCore.workItems` 的主从关系：择一为主存储并定义同步/迁移路径，或在架构图中标明双轨为过渡期并给出淘汰条件。
- [行动点 #0181]: 若需保留可变 `Map`，可将对外类型改为非误导性的可变类型，或封装为不导出内部 `Map` 的类/接口，避免 `Readonly` 与可变实现并存。