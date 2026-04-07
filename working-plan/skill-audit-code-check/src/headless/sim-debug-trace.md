# 审计报告: src/headless/sim-debug-trace.ts

## 1. 漏做需求 (Missing Requirements)

- **[指控]**：`mapSimDebugTickToRuntimeLogEvents` 仅把 `pawnDecisions` 与 `workLifecycleEvents` 写入 `RuntimeLogEvent`；当调用方通过 `snapshotWorkItemsEachTick` 在 `SimDebugTick.workItems` 中采集了工单快照时，这些快照不会进入运行时日志流，调试侧无法在同一观测通道里对照「全量工单表」与差分生命周期事件。
- **[依据]**：`oh-code-design/工作系统.yaml` 在「目标」中要求将世界变化转化为可分配、**可追踪**、可恢复的工作单元；在「接口边界 / 输出」中写明向 UI 提供工作状态与进度来源。本文件已采集 `workItems` 却未映射到日志，属于可追踪链路的缺口（在开启快照选项时尤为明显）。

- **[指控]**：`WorkLifecycleTraceEvent` 声明了可选字段 `reason`，且 `mapSimDebugTickToRuntimeLogEvents` 的 `searchTextParts` 会纳入 `event.reason`，但 `diffWorkLifecycleEvents` 在推送 `work-failed` 等事件时从未写入失败原因；与「失败可解释」的观测诉求不对齐。
- **[依据]**：`oh-code-design/行为系统.yaml` 在「目标」中要求保持行为选择**可解释**、可重放、可测试；工作失败是行为—工作闭环的关键节点，缺少原因字段削弱解释性与检索粒度。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- **[指控]**：`currentClaimedWorkEvents`（约第 229–238 行）在仓库内无任何 TypeScript 引用方，属于已导出但未接线的 API 表面。
- **[影响]**：增加维护者误判（以为某条 headless 路径会依赖它），且与「仅保留有用途的观测入口」的收敛目标相悖；若原为场景/测试预留，当前也未在同目录或 `tests/` 中体现调用，更接近遗留膨胀而非有意的兼容层。

- 未发现典型 `mock` / `temp` / `TODO` 占位或与旧入口并存的死分支；`clonePawnDecisionState` 对 `currentGoal` / `currentAction` 的浅拷贝属快照语义需要，不记为无用兼容。

## 3. 架构违规 (Architecture Violations)

- **[指控]**：本文件置于 `src/headless/`，却导出 `PawnDecisionTrace`、`clonePawnDecisionState` 等被 `src/game/behavior/sim-loop.ts` 等**领域模拟核心**直接引用，形成 **game → headless** 的编译依赖；headless 作为运行形态目录，反成领域 tick 的类型与工具来源，与「调试/投影依附领域模型、而非领域依赖无头宿主实现文件」的常见分层不一致。
- **[依据]**：`oh-code-design/行为系统.yaml`「分层」将决策与状态机留在行为域，且「目标」强调可重放、可测试；`oh-code-design/需求系统.yaml`「需求投影层」职责为向 UI 与**调试工具**输出可读状态——调试轨迹类型更贴近行为/投影子域，而非 headless 包内与 Phaser 无关却仍标名为 headless 的轴心模块。

- **[指控]**：本文件直接依赖 `../runtime-log/runtime-log` 的 `createRuntimeLogEvent`，把无头调试 tick 与运行时日志基础设施绑在同一实现路径上；`oh-code-design` 未单独定义「RuntimeLog」子系统边界，该依赖属于横向能力对竖切模块的侵入，团队若未书面约定，易造成 headless/Node 与浏览器日志会话假设纠缠。
- **[依据]**：同上，以「接口边界未在设计中显式列出 runtime-log」为限，记为**分层约定缺失下的耦合风险**，而非某条 YAML 逐字禁止。

## 4. 修复建议 (Refactor Suggestions)

- **[行动点 #0239]**：在 `mapSimDebugTickToRuntimeLogEvents` 中，当 `input.tick.workItems` 存在且非空时，追加一条或多条 `RuntimeLogEvent`（例如 `Work.Snapshot` 类 category），或在单条事件中附带压缩摘要，使「快照模式」与差分事件在同一日志索引中可联合查询。

- **[行动点 #0240]**：在 `diffWorkLifecycleEvents` 生成 `work-failed`（及将来其它失败类事件）时，从 `WorkItemSnapshot` 或世界差分中尽可能填入 `reason`（若领域层尚无统一失败原因字段，则先在类型与调用约定上收窄 `reason` 的来源，避免长期空字段）。

- **[行动点 #0241]**：对 `currentClaimedWorkEvents` 要么在场景 runner / 测试 / 报表中明确调用并文档化用途，要么删除导出以避免死 API；若保留，应在 `src/headless` 或场景文档中写明「仅用于 XXX 观测」。

- **[行动点 #0242]**：将决策轨迹类型与 `clonePawnDecisionState` 迁至与 Phaser/headless 无关的模块（例如 `game/behavior` 下专用 trace 文件或 `game/debug/`），由 `headless` 仅消费；`mapSimDebugTickToRuntimeLogEvents` 可保留在 headless 或抽成可选适配层，以降低领域核对 `runtime-log` 的硬依赖（依赖注入或懒加载工厂）。
