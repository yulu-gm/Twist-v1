# 审计报告: src/game/time/time-of-day.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 未实现 `oh-code-design/时间系统.yaml` 中「时段判定器」所要求的、面向领域的「当前属于白天还是夜晚」的显式判定与切换点识别；文件仅维护 `minuteOfDay` 并对固定锚点做调色板插值，未导出与策划「白天/夜晚」语义一致的时段枚举或布尔接口，行为系统文档中「来自时间系统的昼夜切换事件」无法由本模块单独满足。
- [依据]: `oh-code-design/时间系统.yaml` 模块「时段判定器」职责；接口边界输出「提供给行为系统的昼夜切换事件」。

- [指控]: 未实现「时间事件层」「时间事件总线」所描述的跨天、时段切换、时间片推进等事件的产生与对外发布；`advanceTimeOfDay` 仅返回新状态，无事件类型、无订阅/广播机制。
- [依据]: `oh-code-design/时间系统.yaml` 分层「时间事件层」、模块「时间事件总线」及关键流程「日常推进」中「向外广播时间片与时段事件」步骤。

- [指控]: 核心数据「时间快照」在设计中要求同时包含第几天、日内进度、**当前时段**、是否暂停、速度档位；本文件将游戏日历状态（`TimeOfDayState`）与控制状态（`TimeControlState`）拆分为两类，且 `TimeOfDayState` 不含「当前时段」字段，与设计的统一快照抽象不一致。
- [依据]: `oh-code-design/时间系统.yaml` 核心数据「时间快照」关键字段。

- [指控]: `oh-gen-doc/时间系统.yaml` 将「白天/夜晚的划分阈值」「一天包含多少游戏时间单位」等列为待配置项；实现中 `MINUTES_PER_DAY` 固定为 24×60，昼夜相关边界隐含在 `TIME_OF_DAY_ANCHORS` 的魔法时刻中，未作为与策划文档对齐的可配置「白天阈值 / 夜晚阈值」暴露。
- [依据]: `oh-gen-doc/时间系统.yaml`「时间相关配置」待配置项；`oh-code-design/时间系统.yaml` 核心数据「时间配置」关键字段（每日总时长、白天阈值、夜晚阈值）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。（无 `mock`/`TODO` 残留分支；`MAX_FRAME_DT_SEC` 与 `effectiveSimulationDeltaSeconds` 为明确的帧长钳制与暂停调速，属正当防护而非临时兼容。）

## 3. 架构违规 (Architecture Violations)

- [指控]: 同一文件混合了时间模型/换算（状态类型、`advanceTimeOfDay`、`minutesPerSecond`）、控制语义（`effectiveSimulationDeltaSeconds`）以及强 UI 耦合的 RGB 调色与插值（`sampleTimeOfDayPalette`、`TIME_OF_DAY_ANCHORS`），与 `oh-code-design/时间系统.yaml` 中「时间模型层」「时间推进层」「时间投影层」的职责边界描述不完全一致；尤其调色板不属于设计文档对「时间投影层」所列的日期、时段、进度等抽象，更接近渲染/UI 表现。
- [依据]: `oh-code-design/时间系统.yaml` 分层「时间模型层」「时间推进层」「时间投影层」职责说明。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0158]: 增加或委托独立模块实现时段判定（白天/夜晚及可选切换回调/事件），使配置中的阈值与设计文档「时间配置」字段对齐，避免昼夜语义仅存在于色板锚点。
- [行动点 #0159]: 由游戏时钟/编排层承担「时间事件总线」与统一时间快照组装；本文件可保留纯函数推进与换算，或明确文档化其仅为子集实现。
- [行动点 #0160]: 将 `sampleTimeOfDayPalette` 及锚点常量迁至 UI 或渲染侧模块，时间核心库只输出时间与时段等领域可读数据。