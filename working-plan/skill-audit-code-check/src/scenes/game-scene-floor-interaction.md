# 审计报告: src/scenes/game-scene-floor-interaction.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `oh-code-design/地图系统.yaml` 中「选区解析器」职责写明「过滤超界格与不可用格」；本文件在 `pointerCell(..., clampToGrid = true)` 时将指针坐标钳制到网格边界内（约 247–265 行），拖拽更新时可能把「网格外」解释为「边缘格」，与「超界不入集」的严格语义是否一致，需与领域侧 `filterTaskMarkerTargetCells` 及预览高亮契约统一核对。
- [指控]: `oh-code-design/交互系统.yaml`「待确认问题」列出「取消当前模式的操作方式与反馈是否需要单独设计」；本类仅暴露 `cancelGesture()`，无内置 ESC/全局取消链路，是否在调用方完整覆盖显式退出，本文件无法自证。
- [指控]: `getCommandMenuCommand` 若返回空（约 149–150 行）则直接 `return`，无 HUD/提示；对照 `oh-gen-doc/交互系统.yaml`「交互反馈 / 状态提示」与 `oh-code-design/交互系统.yaml`「反馈协调层」对模式与反馈的期望，异常或非法 `commandId` 下存在「静默无响应」缺口（若运行时不应出现则可标为低风险）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题（无内嵌 mock；任务标记经 `GameOrchestrator.commitPlayerSelection` 提交）。

## 3. 架构违规 (Architecture Violations)

- [指控]: Phaser `pointerdown/move/up` 与 `commitPlayerSelection`、任务标记 Map 读写、`HudManager.syncPlayerChannelLastResult` 同处一类，输入采集与领域提交紧耦合；对照 `oh-code-design/交互系统.yaml` 分层（输入采集层 / 交互模式层 / 交互意图层 / 反馈协调层），当前实现把多层职责收束在 Scene 助手类中，与「模式注册表、选区/笔刷会话管理器、命令生成器」的理想边界不一致，后续加工具易继续膨胀同一文件。
- [指控]: 直接调用 `HudManager.syncPlayerChannelLastResult`（约 212–214、240–242 行），与 `oh-code-design/UI系统.yaml` 中「界面动作转发层将操作转发给交互系统、状态展示以读模型驱动」相比，地板交互路径上 UI 反馈与领域结果在同方法内串联，属于可运行但偏厚的横向依赖。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0312]: 将 `pointerCell` 的钳制策略与「超界过滤」在文档或 `floor-selection` / `WorldPort` 侧统一约定，避免边缘拖拽在预览与提交之间语义分叉。
- [行动点 #0313]: 按 `oh-code-design/交互系统.yaml` 模块划分，逐步抽出选区会话、笔刷会话与「提交意图」门面，Scene 层只产出规范化输入会话数据，由单一入口生成领域命令并协调反馈。
- [行动点 #0314]: 对 `!command` 分支约定产品行为（忽略 / 回退默认命令 / 提示），并与 `command-menu` 中 ID 枚举完整性对齐，消除静默失败。