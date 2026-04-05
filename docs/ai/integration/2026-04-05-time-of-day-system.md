## 主题

`2026-04-05-time-of-day-system`

## 玩家路径

1. 玩家打开游戏，`GameScene` 从 `Day 1 06:00` 初始化世界时间。
2. `time-of-day` 在每帧读取 `deltaSeconds`，持续推进 `dayNumber` 与 `minuteOfDay`。
3. `time-of-day` 同步输出格式化时间文案与当前昼夜调色板。
4. `scene-hud` 在菜单栏或兼容 `#scene-hud` 容器中展示 `Day N HH:MM`，并提供暂停/开启与 `1x / 2x / 3x` 倍速按钮。
5. 玩家可点击按钮，或按 `Space` / `1` / `2` / `3` 控制时间暂停与倍速。
6. `GameScene` 使用统一的有效模拟时间步长推进 TOD、需求增长、移动插值和交互动作计时。
7. `GameScene` 消费当前调色板，更新背景、格线和文字标签颜色。
8. 玩家切换测试场景或场景重启后，时间回到 `Day 1 06:00`、恢复运行态与 `1x` 倍速。

## 参与系统

- `time-of-day`：维护世界时间、跨天归一化、时间文案和昼夜调色板。
- `scene-hud`：展示时间文案、暂停按钮和倍速按钮。
- `world-grid`：提供网格绘制上下文，配合新调色板重绘格线。
- `pawn-state`：保留现有调试标签语义，仅消费新的文字颜色。
- `selection-ui`：继续维持选区高亮，不随 TOD 改色。

## 当前 UI-first fake

- 昼夜关键帧和调色板锚点先写死在 `src/game/time-of-day.ts` 中。
- 时间控制先做最小按钮与快捷键，不加更复杂的日历、拖拽时间轴或自定义倍速。
- 若远端菜单栏未同步到本地代码，则先落在当前 `#scene-hud` 容器中。

## TDD 顺序

1. `time-of-day` domain：起始时间、时间推进、跨天、格式化与关键帧插值。
2. 文档/索引回归：注册表、系统索引和新 aidoc 文件。
3. 场景接线后跑全量测试与 TypeScript 构建，确认 TOD 不破坏现有选择、移动和 AI 原型。

## fake-to-real 反推顺序

1. 把写死关键帧迁到 `data/` 配置。
2. 把时间状态提升到更高层的世界状态，以支持跨场景保持。
3. 让 `task-planning`、设施和事件系统消费同一世界时钟。

## 必跑回归组合

- `time-of-day` + `scene-hud`
- `time-of-day` + `GameScene`
- `world-grid` + `GameScene`
- `pawn-state` + `task-planning`
