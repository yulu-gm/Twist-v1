# 审计报告: src/game/time/time-event-bus.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `TimeEvent` 仅包含 `day-start` / `night-start` / `new-day` 三类边界事件，未体现设计中对「时间片推进」类广播的要求；若业务期望所有时间相关通知（含逐 tick 或离散时间片推进）均经同一总线分发，则当前类型与 `publish` 载荷无法覆盖该能力。
- [依据]: 见 `oh-code-design/时间系统.yaml` 中「时间事件总线」职责：「对外发布跨天、时段切换、**时间片推进**事件」；同文件「关键流程 / 日常推进」中「向外广播**时间片**与时段事件」。

- [指控]: `DAY_START_MINUTE` / `NIGHT_START_MINUTE` 在模块内写死为 6:00 与 18:00，`detectTimeEvents` 未接收 `TimeOfDayConfig` 或等价「白天/夜晚阈值」入参，与「时间配置驱动昼夜边界」的设计方向不一致；日后若配置扩展为可改阈值，本函数可能与 `world-time.timePeriodForMinute` 及真实推进状态漂移。
- [依据]: 见 `oh-code-design/时间系统.yaml`「核心数据 / 时间配置」关键字段「白天阈值」「夜晚阈值」；`oh-gen-doc/时间系统.yaml`「时间相关配置」中「白天/夜晚的划分阈值」为待配置项。本文件未接入任何配置结构。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

未发现明显问题。

## 3. 架构违规 (Architecture Violations)

- [指控]: `TimeEventBus` 类型将 `subscribers` 作为公开字段暴露，且类型为可变 `Array<...>`（非 `ReadonlyArray`），调用方除 `subscribe`/`publish` 外仍可持有总线并直接改订阅列表，削弱总线作为边界对象的封装，与「时间事件总线」作为对外发布通道的典型接口边界不完全一致。
- [依据]: 见 `oh-code-design/时间系统.yaml`「接口边界 / 输出」中向各子系统提供事件与展示数据的总线角色；公开可变订阅者集合使「唯一入口订阅」的约束无法由类型与结构保证。

- [说明（关联风险，非本文件独责）]: `world-time.ts` 中 `WorldTimeEvent`（如 `period-changed`、`day-changed`）与本文 `TimeEvent` 命名与粒度不同；编排层若长期只向本总线推送 `detectTimeEvents` 结果而不统一两套事件模型，易出现重复语义与重复边界判定。该整合责任主要在调用方，但本文件是当前平行语义的一方实现。
- [依据]: `oh-code-design/时间系统.yaml`「时间事件层」职责「产生白天开始、夜晚开始、跨天等事件」与「分层」中各层职责划分——事件形态宜与单一时间源语义对齐。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0155]: 对照 `oh-code-design/时间系统.yaml` 澄清「时间片推进」是否必须进入本总线；若必须，扩展 `TimeEvent`（或约定与 `WorldTimeEvent` 的映射）并由编排层在每 tick 或按时间片注入 `publish`。
- [行动点 #0156]: 将昼夜边界分钟改为由 `TimeOfDayConfig`（或未来独立的昼夜阈值配置）传入 `detectTimeEvents`，与 `world-time.timePeriodForMinute` 使用同一来源，避免配置化后行为分裂。
- [行动点 #0157]: 将 `createTimeEventBus` 实现改为闭包内保存订阅数组，对外仅导出 `subscribe` / `publish`（及必要的只读诊断接口），避免暴露可变 `subscribers` 数组。