# 审计：`src/game/behavior/`（T-02）

对照文档：`oh-gen-doc/行为系统.yaml`、`oh-acceptance/行为系统.yaml`（及 [`working-plan/remain-old-code-check/README.md`](README.md) 三类定义）。

---

## 一句结论

`rg` 在本目录内**未命中** `mock`、`compat`、`legacy`、`deprecated`、`stub`、`fake`、`双轨` 等关键词；但存在**两套并行的决策/状态表达**：主玩法由 `tickSimulation` + `goal-driven-planning` + `PawnState` 驱动，而 `behavior-state-machine` 与基于 `BehaviorContext`/`scoreActions` 的 `flows/` 流程在**编排器路径上未挂载**，且 `aggregateBehaviorContext` **仅测试引用**，与 `oh-gen-doc` 中「行为上下文汇总」的命名预期部分脱节。

---

## 要解决什么问题

从「初创期理想态」与 route-demand 链路出发，本审计要判断：`src/game/behavior/` 是否含**无文档背书的多套实现**、**仅历史兼容的分支**、或**文档已承诺却落在别处的行为**，避免实现与 `oh-gen-doc` / `oh-acceptance` 长期分叉。

**与 `oh-gen-doc/行为系统.yaml` 的对照要点**

- 文档中的**小人状态机**（空闲 / 移动 / 执行工作 / 满足需求及子状态）与 **状态转换规则**，在代码中既出现在 `behavior-state-machine.ts`（`BehaviorState`、`DEFAULT_BEHAVIOR_TRANSITIONS`、转换与打断优先级），又由 **`sim-loop.ts` 内对 `PawnState` 的 `currentAction` / `currentGoal` / 路径步进** 实际承载；两条线**并非同一运行时对象**。
- 文档中的**漫无目的散步**（随机相邻格、可打断）对应 `wander-planning.ts`、`goal-driven-planning.ts` 中与游荡相关的路径与 `tickSimulation` 中的 `chooseWanderPath` 分支。
- 文档中的**工作决策**（需求优先、再队列工作）在运行主路径上由 `chooseGoalDecision` / `collectGoalDecisionCandidates` 基于 **网格交互点** 与 **PawnState.needs（hunger/rest/recreation）** 完成；与另模块 **`action-scorer.ts` 使用的 `BehaviorContext.needState（satiety/energy）`** 是**不同字段模型**。
- 文档 **任意状态 → 移动（需求打断）** 与 `oh-acceptance` **BEHAVIOR-003**（饥饿打断工作）在 **`sim-loop.ts` 阶段 2.5** 有明确实现（饥饿阈值、`workInterrupts`、`need-interrupt-hunger`），**不依赖** `need-interrupt-flow.ts` 的 FSM。

**与 `oh-acceptance/行为系统.yaml` 的对照要点**

- **BEHAVIOR-001**（空闲散步）：对应 `tickSimulation` 在可决策且选择 `wander` 时的路径规划与移动。
- **BEHAVIOR-002**（空闲转工作）：与工单认领、`workWalkTargets`、走向锚格等协作（详见 `game-orchestrator` / `world-work-tick`，本目录提供步进与目标决策）。
- **BEHAVIOR-003**（紧急需求打断工作）：验收描述含「行为状态机切换」「行动评分器」等措辞；运行路径上**打断与释放工单**已在 `sim-loop` 内闭环，**评分**主路径为 `goal-driven-planning`，与验收文案中的「行动评分器」命名**部分对应**（`action-scorer` 多用于流程层而非 `tickSimulation`）。
- **BEHAVIOR-004**（无资源时的需求处理）：文档允许「退回空闲或疲劳等待」等实现差异；本目录内 `goal-driven-planning` 对无可达目标给出 `*-unavailable`，`tickSimulation` 亦有 `reservation-failed` 等分支，**与验收「视具体实现而定」一致**，仍需产品确认最终表现是否满足期望 UI/状态文案。

---

## 设计上怎么应对

- **应然**：若以 `oh-gen-doc` 为单一事实源，**状态机**、**上下文汇总**、**行动评分**应收敛为**一条**可被 `oh-acceptance` 场景引用的决策链，或与文档**显式**区分「文档化 FSM（策划/验收说明）」与「运行时实现（PawnState）」并补齐 crosswalk。
- **现状偏差**：`behavior-state-machine` 与 `DEFAULT_BEHAVIOR_TRANSITIONS` **文档化程度高**，但 **FSM 创建与转移** 在 `src/game` 生产路径中**未与 `GameOrchestrator` / `tickSimulation` 绑定**（`createBehaviorFSM` 引用集中于 **测试** 与 `flows` 辅助函数）；**易出现「文档与测试围绕 FSM、主循环围绕 PawnState」的分叉**。
- **现状偏差**：`aggregateBehaviorContext` 名义上对应「行为上下文汇总」，但 **生产代码零引用**，且将 `behaviorState` **固定为 `"idle"`**，与真实小人状态**脱节**；若未来接入，需与 FSM 或 `PawnState` 统一。

---

## 代码里大致怎么走

- **对外主入口**：`index.ts` 聚合导出；**主循环**由 `game-orchestrator.ts` 调用 `tickSimulation`（`sim-loop.ts`）：需求推进 → 移动/使用计时 → 到达检测 → 饥饿打断认领行走工单 → **目标候选**（`collectGoalDecisionCandidates`）与 **步进/游荡**（`chooseGoalDecision`、`chooseWanderPath`、`planPathTowardCell`）。
- **规划与寻路**：`goal-driven-planning.ts`（目标候选、A* 路径 `a-star-pathfinding.ts`）、`wander-planning.ts`（邻格随机，`WanderRng` 可注入，便于测试）。
- **参数**：`sim-config.ts` 提供 `DEFAULT_SIM_CONFIG` 与 `createMainSceneSimConfig`（主场景需求增长的缩放），与文档 **行为与时间** 中「读条、移动、需求下降」的节奏相关但**粒度在 YAML 中多为「待配置」**。
- **并行模块**：`behavior-state-machine.ts` 提供转换与打断阈值；`action-scorer.ts` 对 `BehaviorContext` 打分；`flows/need-interrupt-flow.ts` 组合 **FSM + `scoreActions`** 做「工作中断去进食」等**场景级**逻辑——与 **`tickSimulation` 内联的饥饿打断** 构成**两条「需求打断」相关线索**（一个偏流程/FSM，一个偏主模拟步进）。
- **追溯**：`sim-loop.ts` 依赖 `headless/sim-debug-trace.ts` 克隆决策前后状态，用于 `pawnDecisionTraces`；属于**调试/无头能力向领域层渗漏**，并非 mock，但增加层次耦合。

---

## 尚不明确或需要产品/策划拍板

1. **FSM 是否为准验收对象**：`oh-acceptance` 多处提到「行为状态机」；是否要求运行时**唯一**以 `BehaviorFSM` 为真源并与 UI 同步，还是允许**以 PawnState 为准、FSM 仅为文档/测试结构**——需拍板后决定 `flows` 与编排器是否必须挂载。
2. **`action-scorer` 与 `chooseGoalDecision` 共存规则**：两者都可解释「行动评分」；是否计划合并为单一评分器，或明确分工（例如打断专用 vs 常规模拟）并写回 `oh-gen-doc`。
3. **娱乐需求（`recreate`）**：`goal-driven-planning` 含 `recreate` 与 `recreation` 交互点；`oh-gen-doc` 满足需求子状态**细化为进食/休息**，与验收 **BEHAVIOR-004** 主要围绕食物/床铺；**娱乐是否纳入 MVP 验收**需策划确认。
4. **`aggregateBehaviorContext` 的去留**：若确认不用于主游戏，是删除、还是实现后接入编排器以贴合文档「汇总器」——属产品与工程节奏问题。

---

## 问题清单（类型标注）

| 类型 | 说明 |
| --- | --- |
| **多套并行** | **运行时主路径**（`tickSimulation` + `goal-driven-planning` + `PawnState`）与 **`BehaviorFSM` + `flows/night-rest-flow`、`flows/need-interrupt-flow`** 并行描述状态/打断；编排器当前**只驱动前者**，后者主要服务**可测场景**，易造成「同一验收维度下两套故事」。 |
| **多套并行** | **`chooseGoalDecision`（hunger / rest / recreation）** 与 **`scoreActions`（satiety / energy）** 两套需求与打分语境；`need-interrupt-flow` 依赖后者，主模拟依赖前者。 |
| **无用兼容 / 遗留 API 风险** | **`aggregateBehaviorContext`**：导出且对应文档「汇总」概念，但 **生产代码无引用**，且行为状态恒为 `idle`；若长期不接入，符合 README 中「文档已删或从未挂载」类**历史包袱**特征（此处为**代码先于/脱离**主路径）。 |
| **孤立需求** | **`goal-driven-planning` 的 `recreate` 目标**在 `oh-acceptance/行为系统.yaml` 场景条目中**无直接对应用例**；是否保留为正式玩法需策划确认。 |

（`rg` 检索范围：`src/game/behavior/`；关键词含 `mock`、`compat`、`legacy`、`stub`、`deprecated`、`shim`、`fake`、`adapter`、`placeholder`、`TODO`、`FIXME`、`hack`、`bridge` 等，**除注释中与 Phaser/测试注入相关的表述外无额外命中**。）
