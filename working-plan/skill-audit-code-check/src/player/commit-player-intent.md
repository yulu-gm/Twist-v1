# 审计报告: src/player/commit-player-intent.ts

## 1. 漏做需求 (Missing Requirements)
- [指控]: `rebuildTaskMarkersFromCommandResults` 的注释写明服务于 `PlayerWorldPort.replayAll` 等场景，但仓库内 `replayAll` 仅在 `world-core-world-port` / `mock-world-port` 实现，**业务层（如场景）未调用**；该重建函数除测试外亦无其它引用，与「世界已重放而 Phaser 侧任务标记需同步」的闭环尚未在运行时落地。
- [依据]: `oh-code-design/交互系统.yaml` 中「交互意图层」与「反馈协调层」职责要求输入—命令—反馈一致；若存在重放/重同步路径，反馈层应与同一套规则对齐（见同文档「核心流程」与分层描述）。
- [指控]: 一旦未来在重放流程中调用 `rebuildTaskMarkersFromCommandResults`，其实现直接对 `cmd.targetCellKeys` 全量 `applyTaskMarkersForSelection`，**未复用** `commitPlayerSelectionToWorld` 中与 `OrchestratorWorldBridge.getWorld` / `filterTaskMarkerTargetCells` 等价的格过滤；与实时提交路径相比，可能在「建造/伐木/地面物资」等工具上产生**更宽**的叠加标记集合，与 `oh-code-design/交互系统.yaml` 交互意图层「在提交前执行基础校验与过滤」及 `oh-gen-doc/交互系统.yaml` 中「标记显示」应与实际可执行目标一致的体验预期存在偏差风险。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)
- [指控]: `MockWorldSubmitResult` 类型名贯穿 `commitPlayerSelectionToWorld` 的返回值与注释语义，而 `src/game/interaction/domain-command-types.ts` 已说明该类型为 Mock 时代命名、真实网关同样复用。
- [影响]: 阅读与评审时易误判「仅测试路径」，增加维护成本；与「WorldCore 已接网关」的现状认知不一致。

## 3. 架构违规 (Architecture Violations)
- [指控]: 第 85–89 行将 `port` 断言为 `Partial<OrchestratorWorldBridge>`，通过鸭子类型探测 `getWorld`，以在存在时走 `filterCellKeysForToolbarTaskMarkers`，否则回退 `port.filterTaskMarkerTargetCells`。能力未体现在 `PlayerWorldPort` 契约上，依赖具体桥接类型，属于隐式耦合。
- [依据]: `oh-code-design/交互系统.yaml`「接口边界」要求输入输出显式、分层清晰；`oh-code-design/UI系统.yaml` 与交互的协作亦依赖稳定的转发边界，不宜依赖未在端口类型中声明的 `getWorld`。

## 4. 修复建议 (Refactor Suggestions)
- [行动点 #0262]: 在 `PlayerWorldPort`（或窄化子接口）上**显式声明**可选的世界查询能力（例如可选 `getWorldForTaskMarkerFilter`），或保证 `filterTaskMarkerTargetCells` 的唯一实现路径与 `filterCellKeysForToolbarTaskMarkers` 完全一致，移除对 `OrchestratorWorldBridge` 的 `as` 探测。
- [行动点 #0263]: 将 `MockWorldSubmitResult` 重命名为中性名（如 `WorldSubmitResult`）并在契约与调用方全仓替换；同步更新 `domain-command-types.ts` 注释。
- [行动点 #0264]: 若产品需要重放/重同步：在调用 `replayAll`（或等价流程）后**显式调用**标记重建，且重建时对每条已接受命令按**当前世界状态**应用与 `commitPlayerSelectionToWorld` 相同的格过滤规则，或持久化「已过滤格集合」以便无世界快照时仍能一致还原。