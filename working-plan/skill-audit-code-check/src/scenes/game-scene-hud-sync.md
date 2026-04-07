# 审计报告: src/scenes/game-scene-hud-sync.ts

## 1. 漏做需求 (Missing Requirements)

- 未发现明显问题。本文件仅负责将「当前命令菜单项对应的模式文案」与「世界端口快照标签」推送到 `HudManager.syncPlayerChannelHint`，对应 `oh-code-design/UI系统.yaml` 中关键流程「菜单进入操作模式」里「状态区展示当前模式提示」的窄切片；`oh-gen-doc/UI系统.yaml`「状态反馈」中的小人动画/图标、进度条等应由地图叠加层、状态展示模型等其它模块承担，不应强塞在本辅助函数内。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。本文件无 `mock`/`temp`/`TODO` 分支，亦无仅为兼容旧入口而存在的死代码路径。

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题。实现上组合 `presentationForCommandMenuCommand`（展示侧文案）与 `orchestrator.getPlayerWorldPort().lineA.snapshotLabel`（只读快照标签），未写入领域状态，符合 `oh-code-design/UI系统.yaml` 目标「以读模型驱动展示，避免 UI 直接承担领域规则」与分层中界面状态层「订阅领域系统只读数据并转成界面态」的方向；与 `oh-code-design/交互系统.yaml` 接口边界「向 UI 系统提供当前模式与提示文本」一致，由展示函数提供模式行、由编排器提供附加只读脚注，未出现 UI 越权改领域数据的情形。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0315]: `世界快照：${…}` 的拼接若未来多处复用或需国际化，可收口为单一格式化函数或只读 DTO 字段，避免散落字符串模板。
- [行动点 #0316]: 若设计层希望严格区分「交互反馈协调层」与「Scene 胶水代码」，可将「模式行 + 脚注」的装配迁入 `HudManager` 或专用 UI 状态组装器，由 Scene 只传 `activeCommandId` 与 orchestrator 引用；属结构偏好，非当前违规。