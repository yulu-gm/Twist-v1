# 审计报告: src/ui/ui-types.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `SceneHudViewModel`（```81:90:src/ui/ui-types.ts```）聚合菜单焦点、命令菜单、悬停格、玩家通道、时间、名册、B 验收与 `mapFeedback`，与 `oh-code-design/UI系统.yaml` 中「界面状态层」保存展开/工具/模式/悬停（第 18–21 行）、「地图叠加反馈层」职责（第 38–40 行）、核心数据「界面状态」「地图反馈项」字段（第 52–63 行）高度同构，但 **`src/` 内无任何文件以这些类型作注解或导入使用**（仅 `src/ui/index.ts` 做 `export *`），属于设计侧 ViewModel 已落类型、**读模型聚合与驱动路径未实现**的漏接。
- [依据]: `oh-code-design/UI系统.yaml` — `分层.界面状态层`、`模块.地图叠加反馈层`、`核心数据` 中「界面状态」「地图反馈项」。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：本文件仅为类型定义，无 mock、`TODO` 或显式旧系统兼容分支。

## 3. 架构违规 (Architecture Violations)

- [指控]: 存在与 YAML 一致的**理想聚合类型**（`SceneHudViewModel` 等），而实际 HUD 由 `HudManager` 的命令式方法直接改 DOM，二者未通过单一 ViewModel 串联，与 `oh-code-design/UI系统.yaml`「以读模型驱动展示，避免 UI 直接承担领域规则」（第 12 行）及「界面状态层…订阅领域系统只读数据并转成界面态」（第 18–21 行）的**数据流预期**不一致，维护上易形成「蓝图类型」与「实现 API」双轨。
- [依据]: `oh-code-design/UI系统.yaml` — `目标` 第 12 行；`分层.界面状态层`；`风险` 第 94–95 行（地图反馈需统一层级，与分散命令式更新存在张力）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0363]: 实现 `buildSceneHudViewModel(...)`（或等价聚合函数），在领域/场景事件后更新并 `syncHud(vm)`；若短期不采用，可删除或迁出未使用类型，避免与 `HudManager` 并行误导维护者。
- [行动点 #0364]: 若保留 `MapOverlayFeedbackItem`，将 `expiresAtTick` 与 Phaser/HTML 叠加的 **z-index / depth 策略**对齐落实，呼应 `oh-code-design/UI系统.yaml` `风险` 中「统一层级」条款（第 94–95 行）。