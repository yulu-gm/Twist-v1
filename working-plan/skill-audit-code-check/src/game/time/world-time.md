# 审计报告: src/game/time/world-time.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `timePeriodForMinute` 将白天固定为 `[6:00, 18:00)`，昼夜边界未从「时间配置」读取。
- [依据]: 见 `oh-code-design/时间系统.yaml` 中「时间配置」关键字段列出的 **白天阈值**、**夜晚阈值**；当前 `TimeOfDayConfig`（见 `time-of-day.ts`）仅含 `realSecondsPerDay` 与 `startMinuteOfDay`，本文件也未使用配置推导时段，与设计「阈值可配置」不一致。`oh-gen-doc/时间系统.yaml` 亦将「白天/夜晚的划分阈值」列为待配置项。

- [指控]: `WorldTimeEvent` 中 `period-changed` 未携带日内时刻，与设计对时间事件「发生时刻」的字段期望相比信息偏少（订阅方难以区分同一时段标签下的具体边界时刻）。
- [依据]: 见 `oh-code-design/时间系统.yaml` 核心数据「时间事件」关键字段中的 **发生时刻**；本文件该分支仅有 `dayNumber` 与 `period`。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: `advanceWorldClock` 每次构造并返回的 `events: readonly WorldTimeEvent[]` 在全仓库无读取方；主循环未使用 `clock.events`。
- [影响]: 与 `time-event-bus.ts` 中基于快照差分的 `detectTimeEvents` + `publish` 形成 **双轨时间事件模型**，本路径成为未接入主线的重复逻辑；徒增维护成本与语义分裂风险（符合「新系统/新事件形态已存在，旧出口仍保留」类技术债特征）。

- [指控]: 未发现 `mock`、`temp`、`// TODO` 等明显临时分支或测试桩代码。

## 3. 架构违规 (Architecture Violations)

- [指控]: 时间事件对外发布的主路径在编排层通过 `detectTimeEvents` 与总线完成，而本文件仍在「时间推进」内重复产出另一套事件类型，且未被消费，违背 `oh-code-design/时间系统.yaml` 中 **时间事件总线**「对外发布跨天、时段切换、时间片推进事件」所隐含的 **单一、可预期的出口**（实际出口在总线，本处为旁路死代码）。

- [指控]: `period-changed` 的触发条件为「跨日 **或** 时段变化」（第 100–105 行）。当仅 `dayNumber` 变化而 `currentPeriod` 不变时（例如跨日历日但仍处于夜间），仍会发出 `period-changed`，语义上不再是「时段切换」。
- [依据]: 同上设计文档 **时间事件层** 职责：产生「白天开始、夜晚开始、跨天等事件」——跨天与时段切换宜区分；本文件已有独立的 `day-changed` 分支，与上述误发条件叠加易造成订阅语义混乱。

- [指控]: 本文件以纯函数形式返回新 `WorldCore`，不直接修改可变全局状态；对 `WorldCore` 的依赖限于时间与配置字段，未发现 UI 越权写领域数据类违规。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0161]: 由调用链统一事件来源：要么移除 `advanceWorldClock` 的 `events` 组装与 `WorldTimeEvent` 导出（若总线方案为准），要么改为编排层消费 `clock.events` 并弃用重复的快照差分，避免双轨。
- [行动点 #0162]: 将 `period-changed` 的触发条件收窄为 `previousTime.currentPeriod !== nextTime.currentPeriod`，跨日仅依赖 `day-changed`（及总线侧 `new-day` / `day-start` / `night-start`）表达。
- [行动点 #0163]: 将昼夜边界纳入 `TimeOfDayConfig`（或等价配置），令 `timePeriodForMinute` 与 `time-event-bus.ts` 内常量 **共用同一配置源**，以满足设计中的白天/夜晚阈值字段。