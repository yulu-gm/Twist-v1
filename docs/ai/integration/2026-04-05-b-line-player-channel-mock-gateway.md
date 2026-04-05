# 集成文档

## 主题

`2026-04-05-b-line-player-channel-mock-gateway`

## 玩家路径

1. 玩家在工具栏或快捷键选择工具；建造工具使用笔刷拖拽路径，其余工具使用矩形框选（含 Shift/Ctrl 修饰键语义）。
2. 松开指针后，`build-domain-command` 将选区打包为 `DomainCommand`（S0 线间契约形状）。
3. `MockWorldPort`（mock 世界网关）对命令做接受或拒绝，并写入可回放日志；HUD 显示「世界网关：接受/拒绝」类反馈。
4. **仅在接受后**由 `commit-player-intent` 调用 `apply-task-markers` 更新格上任务标记，拒绝时不改已确认标记图。

## 参与系统

- **scene-hud**：玩家通道文案、右下角 B 线验收场景、`HudManager` 与 DOM。
- **selection-ui**：框选草稿、笔刷覆盖格叠加、任务标记视图同步。
- **world-grid**：线段栅格枚举（`gridLineCells`），供笔刷路径去重覆盖格。

## 测试驱动开发与回归

- 领域：`tests/domain/commit-player-intent.test.ts`、`tests/domain/mock-world-port.test.ts`、`tests/domain/player-channel-domain-command.test.ts`、`tests/domain/need-signals.test.ts`、`tests/domain/player-acceptance-scenarios.test.ts`、`tests/domain/world-grid-line.test.ts`。
- 组件：`tests/scene-hud-markup.test.ts`（玩家通道与验收面板 DOM 约定）。

## 伪造到真实反推顺序

1. 将 `MockWorldPort.submit` 替换为 A 线真实世界与工作管线，保留同一 `DomainCommand` 形状。
2. 任务标记改为完全由世界侧事件或只读快照驱动时，可收窄客户端 `applyTaskMarkersForSelection` 的职责。
