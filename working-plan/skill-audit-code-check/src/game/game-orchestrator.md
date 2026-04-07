# 审计报告: src/game/game-orchestrator.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 已存在 `src/game/flows/night-rest-flow.ts`（`setupNightRestFlow` / `applyNightRestTimeEvent`），负责在 `night-start` 将有床小人 FSM 切入 `resting`、`day-start` 以自然完成流唤醒至 `idle`；但全仓库未调用 `setupNightRestFlow`。`GameOrchestrator` 仅在构造函数内对同一 `TimeEventBus` 订阅 `night-start` 并执行 `releaseWalkWorkForRestSeekingPawnsAtNightStart`，未接入上述完整昼夜归宿流，易导致「释放走向工单」与 FSM 夜间归宿语义分裂或长期遗漏。
- [依据]: `oh-code-design/时间系统.yaml`「时间事件层」— 产生时段切换并「为需求、行为、工作系统广播时间边界变化」；`oh-code-design/行为系统.yaml`「行为状态机层」— 管理休息等状态及中断条件；`oh-gen-doc/时间系统.yaml`「夜晚」特点与「时间与行为的关联」；`oh-gen-doc/需求系统.yaml`「休息行为」— 疲劳时寻找床铺休息/睡觉。

- [指控]: `getLastPawnDecisionTraces` 固定返回 `lastPawnDecisionTraces`（本帧始终被清空且从未由 `tickSimulation` 等写入），结构化决策轨迹未落地。
- [依据]: `oh-code-design/行为系统.yaml` 目标—「保持行为选择可解释、可重放、可测试」；文件内注释亦承认「当前 sim-loop 仅输出 AI 文本事件，未产出结构化决策轨迹」。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 第 214–216 行对 `result.aiEvents` 逐条 `console.info`，无日志级别或调试开关，易在生产/测试产生噪声。
- [影响]: 与「可观测性应可配置」的常见工程预期不符；若后续改为结构化日志，此处易成为重复通道。

- [指控]: `getLastPawnDecisionTraces` 以「保持 API 兼容」为由暴露查询接口，但实现恒为空数组。
- [影响]: `GameScene` 或无头调试调用方可能误以为可获得上一帧决策追踪，实际无法用于验收或回放。

## 3. 架构违规 (Architecture Violations)

- [指控]: 未发现明显越权。本文件通过 `OrchestratorWorldBridge` / `PlayerWorldPort` 读写世界，通过 `GameOrchestratorSimAccess` 与 `GameOrchestratorHooks` 分离领域状态与 Phaser 表现，与 `oh-code-design/UI系统.yaml`「以读模型驱动展示，避免 UI 直接承担领域规则」及 `oh-code-design/实体系统.yaml`「应用编排层—协调多实体联动更新」的方向一致；时间推进、事件总线、行为 tick、工单与网格同步聚合于单类属编排职责范畴内的实现选择。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0098]: 在编排器初始化阶段（或与场景共享同一 `TimeEventBus` 的单一入口）调用 `setupNightRestFlow(this.timeBus, { registry, getFsm? })`，并梳理与 `releaseWalkWorkForRestSeekingPawnsAtNightStart` 的先后顺序与职责边界，避免双重 `night-start` 处理互相打架或长期只保留一半逻辑。
- [行动点 #0099]: 在 `tickSimulation`（或行为层）产出并回传 `PawnDecisionTrace[]` 写入 `lastPawnDecisionTraces`；若短期不实现，应将对外 API 标为 `@internal`、改名或文档明示「未实现」，减少误用。
- [行动点 #0100]: 将 `aiEvents` 输出改为可配置调试开关或统一日志门面（级别/采样），默认关闭或降为 `debug`。