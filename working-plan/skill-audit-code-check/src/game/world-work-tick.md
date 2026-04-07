# 审计报告: src/game/world-work-tick.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `autoClaimOpenWorkItems` 对 `open` 工单的选取键仅为「到操作站立格的曼哈顿距离」（`minManhattanToWorkOperatorStand`），未实现策划文档要求的「优先级最高者优先分配」；当前 `WorkItemSnapshot` 也无优先级字段，无法在数据层表达与排序规则一致的序关系。
- [依据]: `oh-gen-doc/工作系统.yaml` 中「工作队列 → 工作分配」流程写明「选择优先级最高的工作」；`oh-code-design/工作系统.yaml` 中「核心数据 → 工作单」列有「优先级」字段，且「工作目录」职责含「支持按类型、优先级、位置查询」。

- [指控]: `tickAnchoredWorkProgress` 在 `workItemAnchorDurationSeconds(claimed.kind)` 为 `undefined` 时直接输出未修改的 `pawn`（约 201–205 行），不会累加读条也不会调用 `completeWorkItem`。`WorkItemKind` 中的 `deconstruct-obstacle` 在 `work-item-duration.ts` 中无配置时长，故该类工单一旦被认领，无法通过本文件约定的「锚格邻接读条 → 落成」路径结束，与 `work-operations` 中仍对 `deconstruct-obstacle` 提供 `completeWorkItem` 分支的事实不一致，形成执行链断裂。
- [依据]: `oh-code-design/工作系统.yaml` 中「工作结算层」职责为「根据执行结果完成、失败或重开工作」；`oh-gen-doc/工作系统.yaml` 中「工作状态」含「执行中 / 已完成 / 失败」等可追踪生命周期——认领后长期无法进入完成路径与此不符。（行走映射由 `world-construct-tick` 的 `WORK_WALK_KINDS` 负责，亦未包含 `deconstruct-obstacle`，与本文件读条缺口叠加后拆除工单更易卡死。）

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。（未见 `mock` / `temp` / 显式 `TODO` 残留；`cloneWorld` 与 `work-operations` 的调用属于正常状态更新路径。）

## 3. 架构违规 (Architecture Violations)

- [指控]: 本文件在 WorldCore 帧逻辑内直接承担「领取开放工单、清理失效目标、锚格读条结算」等职责，与 `oh-code-design/工作系统.yaml` 中抽象的「工作领取器 / 工作结算器 / 工作目录」边界相比，属于把调度与结算细节落在 `game` 根下的过程式模块中；同时与 `work-types.ts` 中并存的 `WorkOrder`（含 `priority`）路径无交集，仅驱动 `WorkItemSnapshot` 队列，加剧「双轨工作模型」下规则不一致的风险。
- [依据]: `oh-code-design/工作系统.yaml`「分层」中「工作调度层」「工作结算层」及「模块」中「工作领取器」「工作结算器」的职责划分；「风险」条目「若工作锁定与实体占用规则不统一，容易产生重复执行」——当前认领排序与 `WorkOrder` 优先级模型不对齐即属于该风险的具体表现之一。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0210]: 在 `WorkItemSnapshot`（或统一的工作目录模型）中落地「优先级」字段，并在 `autoClaimOpenWorkItems` 的比较键中先比优先级、再以距离（或再辅以稳定 tie-break）决胜，与 `oh-gen-doc/工作系统.yaml` 的分配顺序一致。
- [行动点 #0211]: 为 `deconstruct-obstacle` 补齐锚格读条时长配置，或在 `tickAnchoredWorkProgress` 中对「无时长但邻接即应落成」的 kind 给出明确分支并调用 `completeWorkItem`；并核对 `world-construct-tick` 的 `WORK_WALK_KINDS` 是否应包含该 kind，使认领—行走—读条—结算闭环一致。
- [行动点 #0212]: 将「候选工单排序 + 认领条件」抽成与工作调度层命名一致的单模块（或收敛到现有 `work-scheduler`），由 `GameOrchestrator` 仅调用窄接口，减少与 `world-construct-tick` 距离启发式重复散落的维护成本。