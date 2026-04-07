# 时间系统模块审计汇总报告

## 1. 现状总结 (Status Summary)

经过对 `src/game/time/` 目录下核心文件（`world-time.ts`, `time-event-bus.ts`, `time-of-day.ts`）的审计，结合 `oh-code-design/时间系统.yaml` 的理想架构设计，当前时间系统存在以下核心问题：

### 1.1 漏做需求与配置硬编码
- **昼夜阈值未配置化**：设计文档要求“白天阈值”和“夜晚阈值”应为可配置项，但目前代码中（如 `world-time.ts` 和 `time-event-bus.ts`）将昼夜边界硬编码为 6:00 和 18:00。`time-of-day.ts` 中的昼夜边界也隐含在调色板锚点中。
- **时间快照不完整**：设计要求的“时间快照”应统一包含天数、日内进度、当前时段、暂停状态和速度档位。当前实现将状态拆分为 `TimeOfDayState` 和 `TimeControlState`，且缺乏显式的“当前时段（白天/夜晚）”领域状态。
- **事件载荷信息不足**：`WorldTimeEvent` 的 `period-changed` 缺少具体发生时刻；`TimeEvent` 仅包含昼夜和跨天边界事件，未实现设计中要求的“时间片推进”广播。

### 1.2 架构违规与职责混淆
- **双轨时间事件模型**：`world-time.ts` 在推进时间时构造了一套 `WorldTimeEvent` 但全仓库无消费方（旁路死代码）；而 `time-event-bus.ts` 则通过快照差分产生另一套 `TimeEvent`。两者存在语义重叠和维护分裂。
- **领域与表现层耦合**：`time-of-day.ts` 混合了时间模型推进与强 UI 耦合的 RGB 调色板插值逻辑（`sampleTimeOfDayPalette`），违背了时间模型层与时间投影层/UI层的职责分离。
- **事件语义与封装问题**：`world-time.ts` 中的 `period-changed` 在仅跨天但未跨时段时也会误发；`time-event-bus.ts` 暴露了可变的 `subscribers` 数组，破坏了总线的封装性。

---

## 2. 修改建议 (Modification Suggestions)

### 2.1 统一时间配置与时段判定
- **引入统一配置源**：扩展 `TimeOfDayConfig`，加入 `dayStartMinute` 和 `nightStartMinute` 等阈值配置。
- **实现独立的时段判定器**：在领域层明确实现“时段判定”逻辑，基于统一配置输出当前是白天还是夜晚的枚举或布尔值，消除对魔法数字和调色板锚点的依赖。

### 2.2 整合并规范事件总线 (消除双轨制)
- **清理冗余事件产出**：移除 `world-time.ts` 中 `advanceWorldClock` 产生且未被消费的 `events` 逻辑，彻底废弃这套未接入主线的事件模型。
- **完善 TimeEventBus**：
  - 将 `time-event-bus.ts` 确立为唯一的时间事件出口。
  - 修复 `createTimeEventBus` 的封装问题，隐藏 `subscribers` 数组，仅暴露 `subscribe` 和 `publish`。
  - 根据业务需要，评估并补充“时间片推进”事件，同时确保事件载荷中包含精确的“发生时刻”。
  - 修正跨天与时段切换的逻辑判定，确保 `period-changed` 仅在真实时段变化时触发。

### 2.3 职责解耦与状态聚合
- **剥离 UI 渲染逻辑**：将 `time-of-day.ts` 中的 `sampleTimeOfDayPalette` 及相关的 RGB 锚点常量提取到 UI 或渲染侧的模块中，确保时间核心库只输出纯粹的领域时间数据。
- **聚合时间快照**：在编排层或游戏时钟模块中，将分散的时间状态（日历进度、控制状态、当前时段）聚合为符合设计文档标准的统一“时间快照”，对外提供一致的只读视图。
