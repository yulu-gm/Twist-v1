# 审计报告: src/player/world-port-types.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题：`oh-gen-doc/交互系统.yaml` 与 `oh-code-design/交互系统.yaml` 描述的是输入工具、模式流程与**分层职责**（输入采集 / 交互模式 / 交互意图 / 反馈协调），并未以「玩家世界端口」为名逐条列出 TypeScript API。当前接口中的 `submit` 与「交互意图层—把输入结果转为领域命令」、`filterTaskMarkerTargetCells` / `mergeTaskMarkerOverlayWithWorld` 与「反馈协调层—维护…高亮」及 `oh-code-design/UI系统.yaml`「地图叠加反馈层」所依赖的格级信息，在语义上可对齐，**无法从现有 YAML 中指证某一策划条款在该类型上被遗漏**。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 类型名与关联类型仍大量使用 `Mock` 前缀：`MockWorldPortConfig`、`applyMockConfig`、`submit` 的返回类型 `MockWorldSubmitResult`、`lineA: MockLineAPort`（经 `./s0-contract` 再导出自领域命令模块）。
- [影响]: 生产路径 `WorldCoreWorldPort` 也实现同一接口，却长期携带「Mock」语义，易让后续改动误以为仅为测试替身；与 `working-plan/remain-old-code-check/src-player.md` 所述「B 线 / 验收注入」横切一致，**属于命名与边界上的技术债**，而非单文件逻辑错误。
- [依据]: 本文件为上述命名的**权威声明点**；设计侧 `oh-code-design/交互系统.yaml`、`oh-gen-doc/交互系统.yaml` **未**定义「Mock 配置格拒收」「alwaysAccept」等验收注入概念，故这些成员属工程化能力溢出到公共契约。

## 3. 架构违规 (Architecture Violations)

- [历史指控 / 已缓解 #0291]: 同一接口曾聚合交互系统不同分层职责；现已拆出 `PlayerWorldCommandPort`（意图落地 / 会话）与 `PlayerTaskMarkerOverlayPort`（任务标记叠加与格过滤），`PlayerWorldPort` 继承二者并保留 `lineA`，调用方可按依赖收窄类型（如 `commit-player-intent`、`game-scene-floor-interaction`）。
- [依据]: `oh-code-design/交互系统.yaml` 的 `分层`（交互意图层 / 反馈协调层）；`oh-code-design/UI系统.yaml` 的 `分层` 与 `地图叠加反馈层`。
- [历史指控 / 已缓解 #0292]: `lineA` 曾仅在工程类型中出现而无策划侧对应说明；已在 `oh-code-design/交互系统.yaml` 的 `接口边界.程序侧_A线与B线端口` 增补「开发分路 A/B、运行时合并、YAML 仍以分层职责为准」的边界说明。
- [依据]: 同上与 `oh-code-design/UI系统.yaml`「界面状态层」只读消费关系。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0290]: 将 `MockWorldPortConfig` / `MockWorldSubmitResult` / `MockLineAPort` 重命名为中性名（如 `WorldPortGateConfig`、`WorldCommandSubmitResult`、`ReadonlyWorldSnapshotChannel`），并把「仅验收/B 线注入」能力收窄为可选子接口或测试专用类型，与 `oh-code-design` 用语对齐。
- [行动点 #0291] **已落地**: `src/player/world-port-types.ts` 已拆 `PlayerWorldCommandPort` / `PlayerTaskMarkerOverlayPort`，`PlayerWorldPort` 组合二者；编排器仍注入完整 `PlayerWorldPort`，与 `OrchestratorWorldBridge extends PlayerWorldPort` 不变。
- [行动点 #0292] **已落地**: `oh-code-design/交互系统.yaml` → `接口边界.程序侧_A线与B线端口` 已写明 Line A（`lineA`）与 Line B（`submit` 等）的工程分路与运行时合并语义。