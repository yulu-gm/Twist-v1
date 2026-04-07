# 审计：`src/game/flows/`

对照需求事实源 [`oh-gen-doc/行为系统.yaml`](../../oh-gen-doc/行为系统.yaml)、[`oh-gen-doc/时间系统.yaml`](../../oh-gen-doc/时间系统.yaml)，以及验收 [`oh-acceptance/行为系统.yaml`](../../oh-acceptance/行为系统.yaml)、[`oh-acceptance/时间系统.yaml`](../../oh-acceptance/时间系统.yaml)。**未改动任何源码。**

---

## 一句结论

`src/game/flows/` 下的四条链路是「工单注册 → 认领 → 结算」与行为状态机转移的**纯编排**，语义上与上述行为/时间文档中的「执行工作、读条结算、需求打断、昼夜与休息」一致；但 **`rg` 显示这些入口目前主要由 `tests/domain/` 引用，`src/` 生产路径未 `import` 建造/伐木/需求打断/夜间归宿流程**（夜间归宿仅与时间总线测试绑定）。与此同时，`GameOrchestrator` 等对 `night-start` 另有世界层处理，形成与文档同名能力相关的**并行实现**，宜在合并架构时明确单一事实来源，避免长期双轨。

---

## 要解决什么问题（审计视角）

本目录关注的是：流程编排里是否仍存在**仅为兼容早期 mock、演示场景或重复现实玩法路径**而保留的分支；以及这些编排与 **`oh-gen-doc` 行为/时间条款**、**`oh-acceptance` 中 BEHAVIOR-*** / TIME-*** 场景**相比，是补齐文档承诺还是停留在「单测专用捷径」。

---

## 设计上怎么应对（应然与现状偏差）

| 文档/验收关注点 | 应然（摘自 YAML） | 现状（本目录） |
| --- | --- | --- |
| [`oh-gen-doc/行为系统.yaml`](../../oh-gen-doc/行为系统.yaml)「执行工作状态」伐木/建造读条 | 到达工位后进入子状态、可被打断 | `chop-flow` / `build-flow` 直接走工作注册与结算，**不模拟读条内时间片**，与文档「读条随游戏时间推进」的粒度不一致（时间细节落在工单/别处）。 |
| 同上「任意状态→移动（需求打断）」、[`oh-acceptance/行为系统.yaml`](../../oh-acceptance/行为系统.yaml) **BEHAVIOR-003** | 验收表述含「切换为**移动**状态，目标食物」 | `need-interrupt-flow` 在释放工单后 **`working`→`eating`**，未先经 `moving`；若严格按验收字面，存在**流程层与验收表述的间隙**（可能是有意压缩步骤，但需在文档或验收中统一）。 |
| [`oh-gen-doc/行为系统.yaml`](../../oh-gen-doc/行为系统.yaml)「休息中」「天亮退出」、[`oh-gen-doc/时间系统.yaml`](../../oh-gen-doc/时间系统.yaml)「夜晚/白天」「时间事件」 | 昼夜边界驱动行为；[`oh-acceptance/时间系统.yaml`](../../oh-acceptance/时间系统.yaml) **TIME-001** 要求广播夜/昼事件 | `night-rest-flow` 订阅 `TimeEventBus` 的 `night-start` / `day-start`，对有床小人 `resting`、天亮 `completeNatural` 回 `idle`，与文档方向一致；**但未接入当前 `src` 主循环**，与 `GameOrchestrator` 内对 `night-start` 的工单释放逻辑**并行**。 |
| [`oh-acceptance/行为系统.yaml`](../../oh-acceptance/行为系统.yaml) **BEHAVIOR-004** | 无床/不可达时的疲劳表现 | `night-rest-flow` 仅处理 `bedBuildingId` 已定义的小人；无床路径不在本模块展开，与验收「视实现而定」一栏一致，但需与全局 AI 行为对齐以免遗漏。 |

---

## 代码里大致怎么走

- **`build-flow.ts`**：`runBuildFlowScenario` 按 `bed` | `wall` 取建筑规格 → `createBlueprint` → `generateConstructWork` → `claimWork` → `settleWorkSuccess`；床落成后 `pickPawnWithoutBed`（优先调用方小人，否则按 id 字典序取一名无床者）→ `assignBedToPawn`。可选 `constructWorkId` 覆盖工单 id，便于测试隔离。
- **`chop-flow.ts`**：`generateChopWork` → 认领/结算伐木 → 依赖结算产出的拾取工单再认领/结算 → 无存储区则 `dropResource`，有则 `generateHaulWork` 并再走一轮认领/结算。`ensureTreeMarkedForLogging`、`ensurePawnAtCell` 在流程内直接改实体，**跳过路径与移动耗时**，偏「场景一步到位」。
- **`need-interrupt-flow.ts`**：`handleNeedInterruptTick` 在 `working`、持有工单且 `eatPreferredOverWork`（`needActionSuggestion` + `scoreActions`）成立、`canBeInterrupted` 通过时 `releaseWork` 并 `transition(…, "eating")`。`runNeedInterruptScenario` 用 `settleEating` 模拟进食时长后再 `idle` 并重认领同一工单。`defaultNeedInterruptScoringContext` 固定 `time`/`map` 可达性字段，面向单测拼装。
- **`night-rest-flow.ts`**：`applyNightRestTimeEvent` 分支 `night-start` / `day-start`；`setupNightRestFlow` 订阅总线。打断优先级常量与 `DEFAULT_BEHAVIOR_TRANSITIONS` 注释对齐。FSM 来源支持注入 `getFsm` 或模块级 `Map` 登记。

---

## 尚不明确或需要产品/策划拍板

1. **主玩法最终是否以 `EntityRegistry` + 行为 FSM 为唯一领域核心**：若是，应将 `setupNightRestFlow` 等接入与 `TimeEventBus` 绑定的主循环，并收敛 `GameOrchestrator` 中同类规则；若否，本目录是否降级为「仅集成/回归测试工具」需在 `oh-code-design` 或路线说明中写清。
2. **BEHAVIOR-003 是否必须坚持「先 moving 再 eating」**：若坚持，需改流程或改 [`oh-acceptance/行为系统.yaml`](../../oh-acceptance/行为系统.yaml) / 策划描述，避免验收与实现长期各说各话。
3. **建造/伐木编排是否保留「瞬移工位」类捷径**：与 [`oh-gen-doc/时间系统.yaml`](../../oh-gen-doc/时间系统.yaml) 中移动/读条随时间推进的表述在 E2E 上如何统一，是否接受仅在中层测试使用。

---

## 问题清单

| # | 类型 | 简述 |
| --- | --- | --- |
| P1 | 多套并行 | **昼夜与夜间行为**：[`oh-gen-doc/时间系统.yaml`](../../oh-gen-doc/时间系统.yaml) / [`oh-acceptance/时间系统.yaml`](../../oh-acceptance/时间系统.yaml) 要求的时段事件，在 `night-rest-flow.ts` 与 `GameOrchestrator`（`night-start` 释放行走工单等）两条链上分别实现，且后者不驱动本模块的 FSM `resting`。 |
| P2 | 多套并行 | **领域入口双轨**：`flows` 内 `run*Scenario` 与场景/编排层（`src/game/game-orchestrator.ts`、`behavior/sim-loop` 等）是否扮演同一款产品中的同一抽象，当前引用关系显示 **flows 近乎仅测试直连**，易造成「文档对准一套代码、运行时走另一套」。 |
| P3 | 孤立需求（边界未文档化） | **`defaultNeedInterruptScoringContext`**：固定白天正午、食物/床均可达，是典型单测夹具；若未来被生产误用会与 [`oh-gen-doc/行为系统.yaml`](../../oh-gen-doc/行为系统.yaml) 中依赖距离与可达性的决策描述冲突，建议在 API 命名或注释/`oh-code-design` 中标明「仅测试」。 |
| P4 | 无用兼容 / 场景捷径（待确认） | **`chop-flow` 中 `ensurePawnAtCell`**：若不视为正式领域规则，则属于跳过 [`oh-gen-doc/时间系统.yaml`](../../oh-gen-doc/时间系统.yaml) 所述移动耗时的编排捷径，易让单测通过而真实循环仍缺路径模拟。 |
| P5 | 无用兼容 / 测试便利（待确认） | **模块级 `moduleFsmByPawn` + `registerNightRestFsm`**：双通道解析 FSM 利于历史测试注册；若生产只保留注入 `getFsm`，Map 可沦为遗留分支（当前无 `src` 引用则更偏测试基础设施）。 |
| P6 | 文档与实现对齐 | **BEHAVIOR-003**：[`oh-acceptance/行为系统.yaml`](../../oh-acceptance/行为系统.yaml) 写明「切换为移动状态…食物」，与本目录「直入 `eating`」不一致，需策划或文档收敛。 |

---

## 附：`tsc` 基线（与本任务无关）

执行 `npx tsc --noEmit` 时仓库已有既有报错（如 `sim-loop.ts`、`hud-manager.ts`、部分测试）；**本报告仅新增 Markdown，未引入新的 TypeScript 诊断。**
