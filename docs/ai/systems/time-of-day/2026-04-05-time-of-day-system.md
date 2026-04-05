## 目标

提供一个独立于 Phaser 的世界时钟模块，让场景层可以稳定读取 `Day N HH:MM` 与连续昼夜调色板。

## 本系统负责的玩家可见结果

- 玩家能看到世界从 `Day 1 06:00` 开始连续推进。
- 每个完整昼夜在真实时间里耗时 10 分钟。
- 背景、格线和文字随着时间平滑变化，不在整点硬切。
- 玩家可以暂停时间，或切到 `1x / 2x / 3x` 倍速。

## 前置依赖

- `scene-hud` 负责把格式化后的时间文案放到菜单栏或 HUD 容器中。
- `GameScene` 负责消费调色板并重绘场景表现。

## 本系统输入

- `realSecondsPerDay`
- `startMinuteOfDay`
- 每帧 `deltaSeconds`
- 时间控制状态：暂停、`1x / 2x / 3x`
- 写死的关键时间点调色板

## 本系统输出/反馈

- `TimeOfDayState`：`dayNumber`、`minuteOfDay`
- `TimeControlState`：`paused`、`speed`
- `formatTimeOfDayLabel` 输出的 `Day N HH:MM`
- `sampleTimeOfDayPalette` 输出的当前调色板
- `effectiveSimulationDeltaSeconds` 输出的有效模拟时间步长

## 假实现边界

- 允许第一版把关键时间点和颜色锚点写死在模块内。
- 允许第一版只影响背景、格线和文字，不给单位或设施做整体染色。
- 不允许把时间推进或颜色插值直接塞进 `GameScene.update()` 的局部变量里。

## 最先失败的测试

- 测试层级：`domain`
- 触发方式：验证起始时间、时间推进、跨天、格式化和关键帧插值。
- 预期失败原因：项目当前没有独立的世界时钟模块，也没有昼夜调色板采样逻辑。

## 最小通过实现

- 定义 `TimeOfDayState`、`TimeOfDayConfig`、`TimeOfDayPalette`
- 定义 `TimeControlState`
- 实现 `createInitialTimeOfDayState`
- 实现 `advanceTimeOfDay`
- 实现 `effectiveSimulationDeltaSeconds`
- 实现 `formatTimeOfDayLabel`
- 实现 `sampleTimeOfDayPalette`

## 后续反推到底层的接口/规则

- 若后续让 AI、生产或事件系统受昼夜影响，可继续复用同一 `TimeOfDayState`。
- 若后续接入 `data/` 配置，可把关键帧调色板迁出代码。
- 若后续需要跨场景持续运行，再把时钟状态提升到场景外层或世界状态容器。
