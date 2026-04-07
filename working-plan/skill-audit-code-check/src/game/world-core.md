# 审计报告: src/game/world-core.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 经本文件创建的 `WorkItemSnapshot`（`placeTaskMarker`、`registerChopTreeWork`、`registerMineStoneWork`、`registerPickUpResourceWork`）未承载设计文档中「工作单」所要求的关键字段「优先级」与「发起原因」。
- [依据]: 见 `oh-code-design/工作系统.yaml` 中「核心数据」→「工作单」→「关键字段」（含优先级、发起原因）。

- [指控]: 当前 `WorkItem` 路径未体现「工作步骤」结构；若策划要求所有可分配工作均具备可编排步骤（与 `WorkOrder` 一致），则遗留工单模型与架构蓝图不对齐。
- [依据]: 见 `oh-code-design/工作系统.yaml` 中「核心数据」下的「工作步骤」及「工作编排器」相关职责描述。

- [指控]: `getWorldSnapshot` 输出的 `WorldSnapshot` 未包含 `WorldCore` 中的 `grid` 与 `timeConfig`；若「时间投影层」或交互/UI 需要与 `oh-code-design/时间系统.yaml` 中时段、换算规则一致的完整只读视图，则当前快照可能不足以单独支撑投影层需求（需与实际上层调用约定核对）。
- [依据]: 见 `oh-code-design/时间系统.yaml` 中「时间模型层」「时间投影层」职责；对比本仓库 `world-core-types.ts` 中 `WorldSnapshot` 与 `WorldCore` 字段差异。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 未发现 `mock`、`temp`、`// TODO` 等典型临时痕迹；本文件作为大量类型与实现的再导出聚合面（`export type` / `export { ... } from "./..."`），属于门面模式而非废弃代码。

- [指控]: 本文件中的标记→工单逻辑全部落在遗留 `WorkItemSnapshot` / `workItems` Map 上，与 `src/game/work/work-types.ts` 内注释所述「与遗留 WorkItemSnapshot 并存」的 `WorkOrder` + `work/work-generator.ts` 新轨并存，形成两套工作生成与查询路径。
- [影响]: 新轨 `WorkOrder` 可能无法接管伐木/拾取/采矿/拆除等由本文件写入的工单，易出现「生成器写了、调度/UI 仍读旧表」或重复实现，与 `oh-gen-doc/工作系统.yaml` 中「工作队列/自动工作检测」所描述的单一待执行列表叙事不一致。

## 3. 架构违规 (Architecture Violations)

- [指控]: `oh-code-design/工作系统.yaml` 将「根据地图标记、蓝图生成、物资状态变化自动创建工作、去重并合并」划归分层中的「工作生成层」及模块「工作生成器」；本文件在 `registerChopTreeWork` 等 API 中内联完成实体字段写入与 `workItems` 写入，而独立的 `work-generator.ts` 仅服务另一类型 `WorkOrder`，导致「生成层」在实现上分裂为 world-core 内联与独立生成器两路。
- [依据]: 违反该文档「分层」中「工作生成层」与「模块」中「工作生成器」的职责边界表述（生成逻辑应集中、可替换），并与同文件「风险」中关于硬编码链路与扩展成本的警示同向。

- [指控]: `getWorldSnapshot` 对工单的拷贝仅对 `anchorCell` 做深拷贝，`haulDropCell` 等嵌套坐标若存在则仍为引用共享，与「只读快照」的防御性不变式不完全一致。
- [依据]: 与 `oh-code-design/实体系统.yaml` 中「提供与实现无关的实体快照结构」及「对象状态可序列化、可追踪」目标相比，快照字段的隔离程度不足（属数据流稳健性而非 UI 越权）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0197]: 统一工作模型：要么将 `register*` / `placeTaskMarker` 委托给单一「工作生成器」模块并产出与调度层一致的结构，要么明确废弃 `WorkItem` 路径并迁移调用方，避免双轨。
- [行动点 #0198]: 若在过渡期内保留 `WorkItem`，为其补齐与 `oh-code-design/工作系统.yaml`「工作单」对齐的 `priority`、`sourceReason`（或等价字段），并在创建时赋值。
- [行动点 #0199]: 在 `getWorldSnapshot` 中对 `workItems`（及必要时 `entities`）内所有嵌套坐标字段做一致深拷贝，或改用结构化克隆/显式 mapper，保证快照不可变语义。
- [行动点 #0200]: 评估 `WorldSnapshot` 是否需纳入 `timeConfig`（及可选 `grid` 摘要），以满足时间投影与调试/验收对完整世界视图的只读需求；若刻意省略，应在类型或文档中写明契约，避免上层误用。