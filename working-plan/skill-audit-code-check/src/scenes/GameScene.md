# 审计报告: src/scenes/GameScene.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 单一场景类同时承担 HUD 绑定、多路 `Graphics` 生命周期、`GameOrchestrator` 实例化与 hooks 注册、地板交互/相机/键盘装配、YAML 场景热载与运行时日志采集，与文档中「按层按模块拆分 UI / 交互职责」的目标差距大，后续按文档扩展「单独信息面板、教程提示、更多地图反馈」时缺少与 `oh-code-design` 一一对应的代码挂载点。
- [依据]: `oh-code-design/UI系统.yaml` 中 `分层`（界面结构层 / 界面状态层 / 界面呈现层 / 界面动作转发层）、`模块`（菜单模型、工具栏模型、地图叠加反馈层、状态展示模型）及 `扩展点`。

- [指控]: 交互侧「反馈协调」与「地图空间配置重置」仍大量留在本文件（如 `syncMarkerOverlayWithWorld`、`cleanupRuntimeBeforeNextScenario` 对 `taskMarkersByCell` 与 `worldGrid` 的直接处理），与文档中由 **反馈协调层 / 反馈状态仓** 与 **地图网格** 模块分别承载的表述不完全对齐，属于职责落地形态偏「上帝场景」而非模块化漏层。
- [依据]: `oh-code-design/交互系统.yaml` 中 `分层`「反馈协调层」、`模块`「反馈状态仓」；`oh-code-design/地图系统.yaml` 中 `模块`「地图网格」、`分层`「空间模型层」。

- [指控]: `captureRuntimeDebugEntries`（约 552–623 行）在同时存在 AI 决策与工作生命周期事件时，日志条目组合规则较绕（分支依赖 `decisions.length`、`workLifecycleEvents.length`、`aiEvents` 索引对齐），与「为玩家提供清晰的状态反馈」相比，更偏实现细节，若视为面向设计的一致性产品日志，缺少与文档中「状态展示」路径的明确对应说明。
- [依据]: `oh-code-design/UI系统.yaml` `目标` 第一条（清晰的功能入口、模式提示与状态反馈）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 多处使用 `(this.orchestrator.getPlayerWorldPort() as OrchestratorWorldBridge)`（如 `update` 内快照、`syncTreesAndGroundLayer`、`syncPawnDetailPanel`、hooks 内 `syncPawnViews` 等），用断言掩盖「玩家端口未必暴露 `getWorld()` / 桥接形状」的类型事实。
- [影响]: 更换 `PlayerWorldPort` 实现或拆测试替身时，错误易延迟到运行期或在 Scene 层集中爆发。

- [指控]: `applyHeadlessScenarioDefinition` 内以 `port instanceof WorldCoreWorldPort` 分支配合 `window.alert`，属于对特定端口实现的运行时分叉，而非统一的错误/能力协商接口。
- [影响]: 与「可替换世界端口」的演进方向相冲突，增加第二套端口时的分支膨胀风险。

- 未发现 `mock` / `TODO` / 显式临时数据占位；`rng: () => Math.random()`（约 309 行）为浏览器场景可接受随机源，不记为无用兼容。

## 3. 架构违规 (Architecture Violations)

- [指控]: 使用 `window.alert`、`console.error` 向用户暴露场景载入失败与端口类型不符（约 683–686、774–777 行），未走 `HudManager` / 地图叠加反馈等文档描述的 UI 通道。
- [依据]: `oh-code-design/UI系统.yaml` `模块`「地图叠加反馈层」「状态展示模型」及 `目标`（读模型驱动展示、一致反馈）。

- [指控]: `cleanupRuntimeBeforeNextScenario`（约 661–672 行）直接改写 `worldGrid.blockedCellKeys`、`worldGrid.interactionPoints` 并重置 `simGridSyncState`，由 Phaser 场景承担地图空间样板与同步哨兵，跨越「呈现 / 编排」与「空间模型维护」边界。
- [依据]: `oh-code-design/地图系统.yaml` `分层`「空间模型层」「空间规则层」；`oh-code-design/实体系统.yaml` `分层`「应用编排层」（状态变更应由编排协调而非 UI 场景随意改写网格字段）。

- [指控]: `update`（约 386–404 行）每帧末尾调用 `syncDebugPanel()`，在调试面板关闭时仍持续刷新 UI 绑定数据，与「订阅只读数据再刷新」的性能预期不一致（非改领域数据，但属呈现层刷新策略粗放）。
- [依据]: `oh-code-design/UI系统.yaml` `界面状态层` 职责（订阅领域只读数据并转成界面态）所隐含的更新粒度。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0304]: 按 `oh-code-design/UI系统.yaml` 将 `create` 内编排拆为独立装配器或控制器（例如场景生命周期编排、`Orchestrator` 钩子表、HUD 初始绑定），缩短 `GameScene` 单文件职责。
- [行动点 #0305]: 在 `PlayerWorldPort` 或只读访问器上显式声明 `getWorld()` / 快照能力，去掉对 `OrchestratorWorldBridge` 的强制断言；场景载入失败改为 HUD 模态、toast 或内嵌错误区，移除 `window.alert`。
- [行动点 #0306]: 将 `cleanupRuntimeBeforeNextScenario` 中与网格/交互点重置相关的逻辑下沉到 `bootstrapWorldForScene`、`WorldCore` 或地图同步专用服务，由编排层调用，Scene 只触发「切换场景」命令并消费结果。
- [行动点 #0307]: `syncDebugPanel` 改为在 `runtimeDebugLogStore` 变更、面板打开或过滤条件变化时刷新，或节流合并到 `update` 中的低频分支。
- [行动点 #0308]: 为 `captureRuntimeDebugEntries` 整理单一决策表（何时写 `AI.Decision` / `Work.Lifecycle` / `System`），避免索引与长度组合导致的重复或难读日志，并与「状态反馈」目标对齐文档表述。