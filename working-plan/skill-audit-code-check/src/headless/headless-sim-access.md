# 审计报告: src/headless/headless-sim-access.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题。就 `GameOrchestratorSimAccess`（见 `src/game/game-orchestrator.ts`）声明的模拟访问契约而言，本文件已实现 `getPawns` / `setPawns`、`getReservations` / `setReservations`、昼夜与调色板读写、`getTimeControlState`、`getSimGridSyncState` / `setSimGridSyncState` 等全部方法；`setTimeControlState` 未出现在该合约中，故不宜单独归为本文件「未实现接口方法」类漏做。策划侧对暂停与调速的期望见 `oh-code-design/时间系统.yaml` 关键流程「暂停与调速」与接口边界输入项；与当前 getter-only 合约的错位属上层接口形态问题，详细见第 3 节。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。未见 `mock`、`temp`、`TODO` 等占位实现；`initial*` 选项为正常构造注入，非遗留兼容分支。

## 3. 架构违规 (Architecture Violations)

- [指控]: `getTimeControlState()` 直接返回闭包内的 `timeControlState` 对象引用，调用方可通过原地修改字段改变暂停与速度档，而非经由与昼夜类似的显式 setter 或「变更请求」式入口。
- [依据]: `oh-code-design/时间系统.yaml` 中「游戏时钟」维护当前是否暂停与速度档、「关键流程 - 暂停与调速」要求先接收变更再更新时钟状态；`oh-gen-doc/时间系统.yaml`「时间推进 - 影响因素」列出暂停与速度调节。当前实现使控制逻辑可通过 getter 副作用写入，与上述分层中「输入请求 → 更新状态」的表述不一致（无头场景下 `scenario-runner.ts` 的 `applyScenarioTime` 即对返回值做字段赋值）。

- [指控]: `HeadlessGameOrchestratorSimAccess` 额外暴露 `getPawnsRef()`、`getReservationsRef()`，向外部透出与 `getPawns` / `getReservations` 相同的可变数组或 `Map` 引用，削弱封装，任意持有者均可绕过 `setPawns` / `setReservations` 的集中入口直接改状态。
- [依据]: `oh-code-design/实体系统.yaml` 分层中「应用编排层」职责为接收各系统发来的状态变更请求并协调更新；向外暴露可变核心集合引用，增加与「统一实体视图协作」「一致性约束」相悖的旁路写入风险（同文件注释虽说明用于观察/同步，但未在类型或运行时约束仅限测试/编排内部）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0213]: 在上层 `GameOrchestratorSimAccess` 中评估增补 `setTimeControlState`（或与 orchestrator 内部更新路径对齐），本文件实现对称 setter；同时令 `getTimeControlState` 返回只读快照或每次返回浅拷贝，杜绝依赖 getter 副作用改状态。
- [行动点 #0214]: 将 `getPawnsRef` / `getReservationsRef` 限制为测试专用（例如独立测试桩、或 `@internal` 文档与 eslint 约束），生产/场景运行路径仅通过 `setPawns` / `setReservations` 与仿真同步。
- [行动点 #0215]: 若必须保留 ref 以性能同步仿真，在注释或类型上明确「与 orchestrator 约定单方写入方」，避免多写入源破坏 `oh-code-design/实体系统.yaml` 所述编排层单一协调意图。