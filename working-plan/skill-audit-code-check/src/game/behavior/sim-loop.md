# 审计报告: src/game/behavior/sim-loop.ts

## 1. 漏做需求 (Missing Requirements)

- **[指控]**：对「走向类工单」的需求中断仅覆盖饥饿紧迫（`needs.hunger` 与 `HUNGER_INTERRUPT_THRESHOLD`），未对疲劳/精力紧迫做与饥饿对称的工单释放与意图清理。
- **[依据]**：`oh-gen-doc/行为系统.yaml` 中「任意状态 -> 移动 (需求打断)」写明条件为**饱食度或精力值**低于阈值；`oh-code-design/需求系统.yaml` 在「需求快照」与「关键流程」中同时覆盖饱食度与精力值，并在「接口边界 / 输出」中写明需**提供给工作系统的可打断信号**。当前阶段 2.5 仅基于 `pawn.needs.hunger` 推送 `workInterrupts`，未读取 `needs.rest`（或文档语义下的精力/sleep 紧迫）做同类处理。
- **[指控]**：当调用方未传入 `worldWorkItems` 时，`findClaimedWalkWorkIdForPawn` 恒为 `undefined`，饥饿再紧迫也不会生成 `workInterrupts`，已认领走向工单可能无法被本 tick 驱动释放；与「工作被需求打断 → 状态切换」的端到端闭环依赖调用方约定，设计文档未在行为子系统层显式降级为「可选」，存在集成遗漏风险。
- **[依据]**：`oh-code-design/行为系统.yaml`「关键流程 / 工作被需求打断」要求中断后切换行为；`oh-code-design/工作系统.yaml`「工作结算层」需处理失败与释放。本文件通过可选字段把关键输入交给外层，若外层漏传则流程在模拟核内**静默不完整**。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- **[指控]**：`planNextStepTowardCell` 形参 `_pawnsById` 未使用，却参与每次调用签名；`PlannedStepResult` 中的 `blockerPawnId` / `blockerPawnName` / `blockerCell` / `attemptedStep` 在本函数路径上从未赋值，阻塞类 `pawnDecisionTraces` 结果往往缺少设计「可解释」所期望的阻塞主体信息。
- **[影响]**：属于未完成的 API 表面与数据结构占位，增加阅读成本，且与 trace 中 `blocked` 语义不对称（易让调试者误以为已实现格冲突归因）。
- **[说明]**：未发现典型 `mock` / `temp` / 明显仅为兼容旧入口的死代码分支；`needs` 双写在 `PawnState` 上由 `pawn-state` 注释标明过渡期，本文件仅消费该字段，不单独记为 Mock。

## 3. 架构违规 (Architecture Violations)

- **[指控]**：核心模拟纯函数 `tickSimulation` 自 `../../headless/sim-debug-trace` 引入 `clonePawnDecisionState` 与 `PawnDecisionTrace` 类型，使 `src/game/behavior` 依赖 `src/headless` 模块路径。
- **[依据]**：`oh-code-design/行为系统.yaml`「分层」中将**需求投影层**职责表述为向 UI 与调试输出可读状态；决策与执行协调应贴近行为域，而 headless 目录通常表示运行形态（无渲染宿主），不应成为游戏域核心 tick 的编译依赖轴心。当前方向为 **game → headless**，与「调试/投影依附于领域模型、而非领域反过来依赖 headless 实现文件」的常见分层预期不一致。
- **[指控]**：阶段 2「到达后 `move-to-target` → `use-target`」与阶段 3 内对 `move-to-target` + `currentMovePoint` 的到达处理存在大块语义重叠，决策与状态转换分散在两处，削弱「行为状态机层」单一出口的可维护性，与 `oh-code-design/行为系统.yaml`「行为状态机层 / 行为执行协调层」边界清晰化的目标存在张力（非越权写 UI，但属于流程编排上的重复路径）。

## 4. 修复建议 (Refactor Suggestions)

- **[行动点 #0047]**：按 `oh-gen-doc/行为系统.yaml` 与 `oh-code-design/需求系统.yaml`，为「走向类工单」补充与饥饿对称的**疲劳/休息紧迫**中断（阈值与量纲需与 `needs.rest` 或 `energy` 统一），并在 `workInterrupts` / `interruptReasons` / `aiEvents` 中区分原因枚举，便于工作系统结算与回放。
- **[行动点 #0048]**：将 `PawnDecisionTrace`、`PawnDecisionTraceState`、`clonePawnDecisionState` 迁至与 Phaser/headless 无关的共享模块（例如 `game/behavior` 下 `sim-decision-trace.ts` 或 `game/debug/`），令 `headless` 仅消费类型；消除 `tickSimulation` 对 `headless` 路径的依赖。
- **[行动点 #0049]**：删除或实际使用 `planNextStepTowardCell` 的 `pawnsById`（及下游 `nextStepFromPath` / A* 包装）：若需格占用冲突解释，应在寻路或取步时写入 `blocker*`；若不需要，应收窄返回类型与 trace 字段，避免空字段误导。
- **[行动点 #0050]**：抽取「已到达交互点格 → 切换为 `use-target` 并重置路径/计时器」的共用纯函数，供阶段 2 与阶段 3 调用，减少分叉逻辑；并在文档或类型上明确 `worldWorkItems` 与饥饿中断的**必选场景**（例如主场景 tick 必须传入），避免静默跳过工单释放。
