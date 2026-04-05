## 目标

把 `GameScene` 里和时间有关的运行时职责拆开：`src/game/time-of-day.ts` 继续作为世界时间与调色板的唯一权威，`src/ui/hud-manager.ts` 负责 HUD 文案同步，场景层只保留编排逻辑。

## 本系统负责的玩家可见结果

- 玩家看到的昼夜推进节奏保持不变。
- 时间文本、HUD 颜色和场景背景仍然跟随同一套昼夜调色板变化。
- 玩家不会感知到这次重构带来的行为差异。

## 前置依赖

- `src/game/time-of-day.ts` 已经提供时间推进、格式化和调色板采样。
- `src/ui/hud-manager.ts` 已接管时间文案或 HUD 绑定。
- `GameScene` 仍然是运行时入口，只是职责缩小为编排。

## 本系统输入

- 世界时间状态
- 每帧 `deltaSeconds`
- 昼夜调色板采样结果
- HUD 需要展示的时间文案

## 本系统输出/反馈

- `TimeOfDayState`：`dayNumber`、`minuteOfDay`
- `sampleTimeOfDayPalette` 输出的当前调色板
- `formatTimeOfDayLabel` 输出的 `Day N HH:MM`
- HUD 文案和颜色同步结果

## 假实现边界

- 允许继续保留现有昼夜关键帧和配色锚点，不引入额外时间语义。
- 允许场景层继续消费调色板做背景和文字配色，但不要再把 DOM/HUD 同步逻辑写回 `GameScene`。
- 不允许在 `GameScene` 内重复实现时间推进、格式化或调色板插值。

## 最先失败的测试

- 测试层级：`domain` + `scene`
- 触发方式：验证 `time-of-day` 的状态推进与调色板输出保持稳定；验证 HUD 同步逻辑仍能从独立消费者读取时间文案
- 预期失败原因：时间语义仍耦合在 `GameScene`，或 HUD 同步未完成迁移

## 最小通过实现

- 保持 `src/game/time-of-day.ts` 作为唯一时间权威
- 让 `src/ui/hud-manager.ts` 读取格式化时间并更新 HUD
- 保留 `GameScene` 对背景和文字颜色的调色板消费，但移除直接的 DOM/HUD 编排

## 后续反推到底层的接口/规则

- 若后续还要让更多 UI 区域显示时间，继续复用同一套 `formatTimeOfDayLabel` 和调色板采样结果。
- 若后续需要跨场景持久化时间状态，再把 state 提升到更高一层的世界状态容器。
- 若后续需要数据驱动调色板，再把关键帧定义迁出代码，但不要改变 `time-of-day` 的权威地位。
