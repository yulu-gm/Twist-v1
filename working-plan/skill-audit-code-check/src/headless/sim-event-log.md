# 审计报告: src/headless/sim-event-log.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `recordWorldDiff` 对工作项仅发出 `work-created` / `work-claimed` / `work-completed` 三类事件；当同一工单从「已领取」退回未领取（`wasClaimed && !isClaimed`）、`failureCount` 递增、或新建工单带 `derivedFromWorkId` 时，本文件不生成对应事件。同仓库 `src/headless/sim-debug-trace.ts` 中 `diffWorkLifecycleEvents` 已覆盖 `work-released`、`work-failed`、`work-derived`，两套 headless 可观测语义不一致，依赖 `SimEventCollector` 的断言可能漏掉释放、失败与派生链路。
- [依据]: `oh-code-design/工作系统.yaml` 目标与分层——「将……转化为可分配、**可追踪**、**可恢复**的工作单元」；「工作调度层」职责含「管理领取、锁定、**取消**、**失败重试**」；「工作结算层」含「根据行为执行结果更新工作状态」「**触发后续派生工作**」。当前 `SimEventKind` 未覆盖释放/失败/派生，与上述「可追踪」「失败重试」「派生」叙事不完整对齐。

- [指控]: `recordPawnDiff` 在 `unionIds` 并集遍历中，若某一 `id` 仅存在于 `before` 或仅存在于 `after`（`!pb || !pa`），直接 `continue`，不发出任何小人侧差分事件；小人入场/离场若只体现为数组成员增减，则 `SimEvent` 流中看不到对应过渡（除非另有世界层实体事件且与小人一一对应）。
- [依据]: `oh-code-design/实体系统.yaml` 目标含「保证对象状态可序列化、**可追踪**、可做纯规则计算」；在 headless 场景下若小人集合本身会变化，仅靠「前后均存在」的成对比较会削弱可追踪性（与设计层对可追溯状态的期望存在张力；是否必须在 `SimEvent` 层暴露需结合验收场景裁定）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题（无 Mock、`TODO` 或明显仅为兼容死代码的分支；工单差分逻辑为真实快照对比）。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题：模块职责为纯差分与事件收集，通过 `import type` 依赖 `PawnState` / `WorldSnapshot` 等类型，未直接修改领域状态或越层调用游戏核心写入接口。
- [补充说明（非设计条文指控）]: `getEvents` 实现返回内部 `events` 数组引用，调用方若绕过类型约束在运行期 `push`/`splice` 会破坏收集器不变式；若项目规范要求 headless 侧只读视图，宜在实现层冻结副本或文档化禁止变异（当前 `oh-code-design` 未单列本收集器 API，故不升格为正式「违规」条款）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0243]: 扩展 `SimEventKind` 与 `recordWorldDiff` 中与工单相关的分支，使释放、失败计数上升、`derivedFromWorkId` 出现等与 `diffWorkLifecycleEvents` 对齐；或抽取共享的「工单生命周期归一化」函数，供 `sim-event-log` 与 `sim-debug-trace` 共用，避免双轨漂移。
- [行动点 #0244]: 若产品需要在小人集合增减时仍可断言：为仅 `before` 或仅 `after` 存在的 `id` 增加显式事件种类（例如 `pawn-removed` / `pawn-added`），或在 headless 使用约定中明确「小人集合固定、仅状态变化」的前提。
- [行动点 #0245]: 将 `getEvents` 改为返回不可变快照（如 `Object.freeze([...events])` 或只读包装），或在 `SimEventCollector` 接口注释中约定调用方不得修改返回值，降低调试代码污染事件流的风险。