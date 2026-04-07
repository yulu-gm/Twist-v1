# 审计报告: src/game/work/work-scheduler.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `getAvailableWork` 虽按 `priority` 降序与 `workId` 字典序排序，与 `oh-gen-doc/工作系统.yaml`「工作队列 · 工作优先级」的排序意图一致，但第二个参数 `_pawnId` 未参与任何过滤；未落实 `oh-code-design/工作系统.yaml` 中「工作领取器」对空闲小人暴露**可领取**工作时应结合的资格与约束（同文件「扩展点」所列技能、区域限制等）。
- [依据]: `oh-code-design/工作系统.yaml` 模块「工作领取器」职责与「扩展点」中「支持在后续加入更复杂的前置条件，例如材料、技能、区域限制」。

- [指控]: 本文件仅实现 `open`/`claimed` 之间的领取与释放语义，未覆盖 `oh-code-design/工作系统.yaml`「工作调度层」职责中明示的**取消**与**失败重试**管理；若这些能力完全由其他模块承担，本文件作为调度入口未在 API 或注释上与设计分层对齐，易形成「调度层职责缺口」。
- [依据]: `oh-code-design/工作系统.yaml` 分层「工作调度层」职责：「管理领取、锁定、取消、失败重试」。

- [指控]: 设计中的「工作占用记录」包含锁定时间等字段（`oh-code-design/工作系统.yaml` 核心数据「工作占用记录」）；当前认领路径仅更新 `WorkOrder` 的 `status` 与 `claimedByPawnId`，本文件未体现占用时间或可观测的锁定记录，与「锁定目标，避免多个小人重复抢占」的完整可追溯性有差距。
- [依据]: `oh-code-design/工作系统.yaml` 核心数据「工作占用记录」关键字段（含「锁定时间」）；模块「工作领取器」职责「锁定目标，避免多个小人重复抢占」。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `_pawnId` 在 `getAvailableWork` 中刻意未使用，属于静默占位 API；无 `mock`/`temp`/`TODO` 等临时实现痕迹。
- [影响]: 调用方容易误认为已按小人做资格或区域过滤，与 `oh-gen-doc/工作系统.yaml`「工作分配」中隐含「分配给空闲的小人」的筛选尚未在本函数内体现。

- 除上述占位参数外，未发现 Mock 数据或明显仅为兼容旧接口而死代码分支。

## 3. 架构违规 (Architecture Violations)

- [指控]: `claimWork` / `releaseWork` 通过 `registry.orders.set` **就地变更** `WorkRegistry` 内 Map 条目；而同仓库中 `src/game/work/work-operations.ts` 的 `claimWorkItem` 对 `WorldCore` 采用 `cloneWorld` 后替换工作项的不可变更新风格。两套认领语义并存（`WorkOrder` 寄存器路径 vs `WorkItemSnapshot` 世界路径），加剧「锁定状态与全局世界状态」不同步风险。
- [依据]: `oh-code-design/工作系统.yaml` 风险条款：「若工作锁定与实体占用规则不统一，容易产生重复执行」；分层上「工作调度层」应与「工作模型层」「工作结算层」边界一致。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0182]: 为 `getAvailableWork` 要么实现与 `oh-code-design` 扩展点一致的过滤（技能、区域、材料等），要么将参数改为可选并文档化「当前未过滤」，避免静默忽略 `_pawnId`。
- [行动点 #0183]: 在架构上明确「取消 / 失败重试」由调度层哪些导出函数承担，或在本模块补充与 `oh-code-design`「工作调度层」对齐的 API，避免职责散落在 flow 中却无设计对照。
- [行动点 #0184]: 评估将 `WorkOrder` 认领与 `claimWorkItem` 统一为同一套数据与更新策略（例如一律经 `WorldCore` 或一律返回新 registry 快照），降低双轨锁定与实体占用不一致的概率。