# 审计：`src/headless/`（T-16）

对照文档：`oh-acceptance/时间系统.yaml`、`oh-acceptance/工作系统.yaml`、`oh-acceptance/行为系统.yaml`（及 [`working-plan/remain-old-code-check/README.md`](README.md) 任务说明）。

---

## 一句结论

`src/headless/` 通过 **同一套 `GameOrchestrator` + 内存 `SimAccess`** 驱动无 Phaser 模拟，并在 **`WorldCoreWorldPort.applyMockConfig`**、**`ScenarioDefinition` 数据形态**（命令菜单 ID、手动验收字段）上为场景测试单独留出了与「主场景玩家输入」可分叉的约定；**观测面**同时存在 **tick 差分事件（`sim-event-log`）**、**报表快照（`sim-reporter`）** 以及 **刻意模仿 HUD/反馈的 `captureVisibleState`**，与 `oh-acceptance/*.yaml` 中 **presentation** 条款的关系是**间接对齐**，未形成 YAML 级的双向追溯。

---

## 要解决什么问题

本审计要判断：场景运行器、观测与报表是否在**无头路径**与**真实交互路径**之间维护了**第二套**配置或语义，从而导致验收文档（`oh-acceptance/`）若只对照主游戏会产生盲区，或只对照旧场景 JSON/YAML 会偏离策划验收条目。

**与 `oh-acceptance/时间系统.yaml` 的对照要点**

- **TIME-001 / TIME-002**（日内推进、昼夜切换、跨天归一）：`headless-sim` 每 tick 走 `orchestrator.tick`；`sim-event-log` 在世界快照上根据 `currentPeriod` 变化发出 `day-start` / `night-start`，可用于断言「时段切换」类领域结果，但 **YAML 中的「时间事件总线广播」** 在仓库语义上与 **差分导出事件** 是否等价需工程上自行约定，**非字面同一概念**。
- **TIME-003**（暂停冻结）：`scenario-runner` 的 `applyScenarioTime` 可写入 `paused` 与 `world.time`；`scenario-observers` 的 `assertVisibleHudTime` 读取 `world.time.paused`，与验收中 **「UI 时钟停止」** 的 headless 替身一致（**无真实 UI**）。
- **TIME-004**（极大帧增量的上限保护）：`HeadlessSim.runUntil` 的 `deltaMs` 由调用方决定，场景层 **未内置** 与「安全截断」条款的显式对齐说明；若单测用恒定 16ms tick，则 **不会自动覆盖** 文档所述卡顿单帧大增量场景。

**与 `oh-acceptance/工作系统.yaml` 的对照要点**

- **WORK-001 / WORK-002**（伐木链、拾取搬运）：`scenario-runner` 支持蓝图/资源/树实体拼装 + `playerSelectionAfterHydrate` 走 `commitPlayerSelection`，期望类型含 `work-item-*`、`entity-kind-*` 等，可在领域面对齐「工单存在/完成」；**presentation** 条目（标记 UI、读条动画等）在 headless 中 **无渲染层**，仅靠 `captureVisibleState`、`manualAcceptance` 等 **间接** 覆盖。
- **WORK-003**（目标消失）：`scenario-helpers.invalidateScenarioEntity` 注释明确为 **scenario-only** 外部失效模拟，与验收 **「目标实体失效 → 工单失败/取消」** 的用例意图一致，但属于 **测试专用 API**，策划若只看产品路径容易忽略其存在。
- **WORK-004**（争抢互斥）：`claimConstructBlueprintAsPawnName` 在装载后 **直接 `claimWorkItem`**，用于缩短「多人争一单」 setup，**跳过了** 从行为决策到认领的完整广播路径，存在 **与实机争用顺序不一致** 的风险（取决于测试如何编写）。

**与 `oh-acceptance/行为系统.yaml` 的对照要点**

- **BEHAVIOR-001～004** 强调空闲散步、转工作、饥饿打断、无资源时的表现：`headless` 主要断言 `PawnState`、`SimEventKind`（如 `pawn-goal-changed`）与世界工单；**UI 状态面板** 文案在验收 YAML 中出现，而 headless **不渲染面板**，仅有 `debugLabel` / `VisibleStateSnapshot` 类摘要；**策划期望的可见文案**与代码字段 **未在 `oh-acceptance` 中逐字段绑定**。

---

## 设计上怎么应对

- **应然**：若以 `oh-acceptance/*.yaml` 为对外验收源，应明确 **哪些 scenario_id 由 headless 自动化覆盖**、哪些 **仅 presentation** 需人工或 UI 层测试；并在文档或 crosswalk 中标出 **`applyMockConfig` / `manualAcceptance` / `claimConstructBlueprintAsPawnName`** 等测试钩子与产品路径的差异。
- **现状**：`ScenarioDefinition` 同时承载 **领域装载**（grid、pawns、entities）与 **半 UI 观测**（`uiObservation`、`manualAcceptance`），后者 **不在类型层面强制** 与 `oh-acceptance` 场景 ID 对应，易产生 **第三套叙事**（既不是主游戏也不是 YAML 结构化场景）。
- **观测双栈**：`sim-event-log`（差分事件）与 `sim-debug-trace`（决策轨迹、可映到 `runtime-log`）并行；报表默认走事件 summary + pawn 摘要。**未统一**为单一「可观测性契约」，增加阅读成本但与「双轨 mock」不同——属 **能力分层** 而非旧代码分叉。

---

## 代码里大致怎么走

- **入口装配**：`headless-sim.ts` 构造 `WorldCore` + `WorldCoreWorldPort` + `createHeadlessSimAccess` + `createGameOrchestrator`，`hooks` 为 **全 NOOP**，避免 Phaser/UI 回调；每 tick 在 orchestrator 之后对 pawns / `getWorldSnapshot` 做差分写入 `SimEventCollector`。
- **场景管线**：`scenario-runner.ts` 中 `hydrateScenario` 按序写入障碍、zone、树、资源、蓝图、pawn、可选 `domainCommandsAfterHydrate`、`playerSelectionAfterHydrate`，并可 `applyMockConfig`；`runScenarioHeadless` 再按 `tickScheduleAfterHydrate` 前进并跑 `expectations`，最后 `generateReport` 合并断言结果。
- **玩家输入对齐**：`commitPlayerSelection` 与注释所述一致，强调避免手写领域命令与工具栏不一致；**语义解析**依赖 `src/data/command-menu`（`scenario-observers` / `scenario-types`）。
- **报表与可见态**：`sim-reporter.ts` 输出 tick、世界时间、pawn 摘要、事件统计；`scenario-observers.ts` 将世界时间格式化为 `timeLabel` 等，**扮演** 验收里 HUD/反馈的只读替身。
- **导出**：`index.ts` 聚合上述能力供测试与工具使用。

---

## 尚不明确或需要产品/策划拍板

1. **`oh-acceptance` 中 presentation 条款** 是否要求 **任何** 自动化映射到 `ScenarioDefinition.manualAcceptance`，还是接受「仅领域 + headless 替身 HUD」？
2. **`applyMockConfig`（alwaysAccept / rejectIfTouchesCellKeys）** 在验收中是否有等同的「玩家渠道一定成功/失败」条款，还是纯粹 **测试夹具**——若属后者，是否应在 README 或 YAML 中标注 **非产品承诺**。
3. **TIME-004** 是否在无头回归中 **必须** 以「大变 deltaMs」用例覆盖，还是仅保留在集成/实机层。
4. **`claimConstructBlueprintAsPawnName` 与 WORK-004** 的验收叙事：策划是否接受「直接认领」作为 **领域互斥** 的充分验证，还是必须 **多小人从决策环争抢** 才算通过。

---

## 问题清单（类型标注）

| 类型 | 说明 |
| --- | --- |
| **场景与主路径分叉** | `hydrateScenario` 调用 `WorldCoreWorldPort.applyMockConfig`（`scenario-runner.ts`），为场景提供 **alwaysAccept / 按格拒绝** 等与真实玩家通道可能不一致的门控。 |
| **场景与主路径分叉** | `ScenarioDefinition.claimConstructBlueprintAsPawnName` **绕开** 行为层争抢，直接 `claimWorkItem`，与 `oh-acceptance/工作系统.yaml` **WORK-004** 的叙事相比可能 **过强或过弱**（取决于是否只测互斥数据而非决策顺序）。 |
| **与 oh-acceptance 映射不完整** | `manualAcceptance`、`uiObservation` 位于场景定义侧，**无强制** 与 `oh-acceptance/*.yaml` 的 `scenario_id` 对齐，易出现 **第四纪文档**（场景 YAML/TS 内手写步骤）与仓库内 `oh-acceptance/` **双源**。 |
| **presentation 替身边界** | `captureVisibleState` / `assertVisibleHudTime` 等用领域状态 **模拟** 验收中的 UI/反馈表述；**不等于** Phaser/UI 管线，与 `oh-acceptance` presentation 条款为 **弱对照**。 |
| **时间验收细项** | `oh-acceptance/时间系统.yaml` **TIME-004**（单帧大增量的安全截断）在 headless 层 **无标配场景**；`runUntil` 的 `deltaMs` 由调用方决定，**条款覆盖度不明**。 |
| **事件语义命名** | 验收文案中的「时间事件总线」与 `sim-event-log` 的 `day-start`/`night-start` **命名与发射位置**（快照差分）是否视为同一验收对象，**文档未写明**。 |

（`rg` 检索范围：`src/headless/`；关键词含 `mock` 时 **主要命中** `applyMockConfig`；未见成片 `legacy`/`deprecated` 标记；**mock 语义集中于世界端口配置**。）
