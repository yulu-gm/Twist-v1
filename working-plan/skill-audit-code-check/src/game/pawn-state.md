# 审计报告: src/game/pawn-state.ts

## 1. 漏做需求 (Missing Requirements)

- [依据说明]: `oh-code-design/实体系统.yaml` 核心数据「小人实体」关键字段含位置、行为状态、当前目标、携带物标识、饱食度、精力值、床铺归属等；`oh-gen-doc/实体系统.yaml` 亦要求小人具备分配床铺等关系字段。
- [结论]: 本文件顶部注释已限定职责为「逻辑格、移动过渡与显示用派生数据」。床铺归属与携带物在仓库中由实体层 `PawnEntity`（如 `bedBuildingId`）承载时，与设计「实体原型定义 / 关系一致性规则」分层一致，**不强制**在本快照类型中重复全套实体字段。`PawnState` 已覆盖 `logicalCell`、移动插值、`currentGoal`/`currentAction`、`satiety`/`energy`、工单读条等与行为/时间推进相关的状态。
- [补充]: `oh-code-design/需求系统.yaml` 核心数据「需求快照」含饥饿阶段、疲劳阶段；本类型仅持标量与已弃用的 `needs`，阶段若完全缺失且未在「需求档案」模块单独建模，则属系统级缺口，**单就本文件无法断言为漏做**，需对照需求模块实现验收。
- **小结**: 未发现明显问题（在「PawnState 为 sim/显示侧状态、实体字段归实体注册表」这一分工前提下）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `PawnState.needs`（约第 96–100 行）标注 `@deprecated`，注释写明与 `advanceNeeds` 双写；配合从 `./need/need-utils` re-export 的 `advanceNeeds` / `applyNeedDelta` / `withPawnNeeds`，形成「紧迫度型 `needs`」与「饱食度/精力」两套并行语义。
- [依据]: `oh-code-design/需求系统.yaml` 强调以饱食度、精力值与需求阶段作为统一快照语义，双轨字段增加与文档不一致的实现面。
- [影响]: 调用方若混用 `needs` 与 `satiety`/`energy`，易出现决策与展示分叉；`applyNeedDelta`（在 `need-utils` 中）仅改 `needs` 时更易与标量不同步（需与 `need-utils` 联审）。

## 3. 架构违规 (Architecture Violations)

- [指控]: 本文件既 `import` `need-utils`（`formatPawnDebugLabel`），又在第 8–13 行 **re-export** `advanceNeeds`、`applyNeedDelta`、`DEFAULT_PAWN_NEEDS`、`withPawnNeeds`；而 `need-utils` 反向 `import` `PawnState` 等类型自 `../pawn-state`，构成 **pawn-state ↔ need-utils 循环依赖**。
- [依据]: 违反 `oh-code-design/需求系统.yaml` 分层意图——需求演化与档案应通过「需求模型层 / 需求档案 / 需求演化引擎」边界对外，而非由「小人网格状态」模块兼作需求 API 出口；循环依赖亦削弱模块可测试性与加载顺序确定性。
- [指控]: 同上 re-export 使「需求协调层」的单一入口被旁路，调用方可从 `pawn-state` 间接依赖需求演化实现细节。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0151]: 移除对 `need-utils` 的 re-export，需求相关 API 统一从 `./need/need-utils`（或未来的 `need/index`）导入；打破与 `pawn-state` 的循环（例如将 `formatPawnDebugLabel` 与 `PawnState` 类型依赖抽到无环的 `pawn-types` 或 `need` 侧纯函数模块）。
- [行动点 #0152]: 制定 `needs` 字段下线计划：仅保留 `satiety`/`energy`（及策划要求的阶段字段），或改为由标量派生的只读计算属性，删除双写路径。
- [行动点 #0153]: 在需求模块中显式实现「需求快照」中的阶段字段（若尚未实现），避免长期仅靠阈值在各处重复计算。