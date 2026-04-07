# 审计报告: src/game/need/need-utils.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `applyNeedDelta` 在完成交互（如进食、休息）时仅累加 `needs` 三个字段，不同步更新 `PawnState` 上的 `satiety` / `energy`。策划文档要求进食/休息后对应生理量恢复，且设计中的「需求快照」将饱食度、精力值与需求状态一并描述。
- [依据]: 见 `oh-gen-doc/需求系统.yaml` 中「饱食度」机制（进食后饱食度恢复）、「精力值」机制（睡眠期间精力值逐渐恢复）；见 `oh-code-design/需求系统.yaml` 中「核心数据」需求快照的关键字段（饱食度当前值、精力值当前值）及「需求模型层」职责（约束需求状态与实体状态的映射关系）。`sim-loop` 在交互完成时调用 `applyNeedDelta(updated, point.needDelta)`，而 `world-grid` / `world-sim-bridge` 配置的 `needDelta` 语义上对应缓解饥饿/疲劳，与仅改 `needs` 而不改 `satiety`/`energy` 存在缺口。

- [指控]: `advanceNeeds` 仅按 `ratesPerSecond` 与时间片做线性推演，未接收「当前行为/活动/是否在进食或睡眠」等上下文；与设计中的需求演化应按行为上下文区分下降或恢复不符。
- [依据]: 见 `oh-code-design/需求系统.yaml` 中「需求计算层」职责（根据时间、活动、休息、进食计算需求变化）及「需求演化引擎」步骤（根据行为上下文计算下降或恢复量）。本文件作为时间驱动入口未体现该输入，若上下文在其他层统一换算进 `ratesPerSecond`，应在架构上显式化，否则视为未落实设计分层表述。

- [指控]: 本模块未产出或更新「饥饿阶段、疲劳阶段」等离散阶段信息；设计在需求快照中列出此类字段。
- [依据]: 见 `oh-code-design/需求系统.yaml`「核心数据」中需求快照关键字段（饥饿阶段、疲劳阶段）。若阶段完全由其他模块从数值推导，本文件可视为未参与；当前文件中无阶段计算，存在与设计条目不对齐的风险，需全局确认责任归属。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题（无 `mock` / `temp` / `TODO` 占位）。`needs` 与 `satiety`/`energy` 的双写在 `pawn-state` 中已标注为过渡期行为，本文件配合该策略，属于已知技术债而非隐蔽死代码。

## 3. 架构违规 (Architecture Violations)

- [指控]: `applyNeedDelta` 与 `withPawnNeeds` 只维护一套 `needs` 数值，可能在运行中与 `satiety`/`energy` 短暂或长期不一致，削弱「需求状态与实体状态映射」的单一事实来源。
- [依据]: 同上 `oh-code-design/需求系统.yaml`「需求模型层」职责；与 `oh-gen-doc/需求系统.yaml` 中饱食度/精力值作为主机制的描述相比，交互结算路径若只动 `needs`，属于数据模型边界不清晰。

- [指控]: `formatPawnDebugLabel` 放在需求工具模块中，职责上更贴近「调试/投影」而非纯需求数值计算；与 `oh-code-design` 中「需求投影层」为 UI/调试输出可读状态的划分相比，当前归属略模糊（仅为模块组织问题，不构成严重越权）。
- [依据]: 见 `oh-code-design/需求系统.yaml`「分层」中需求投影层职责（为 UI 和调试工具输出可读状态）。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0144]: 在交互完成路径上，使 `needDelta` 的语义同时作用于权威字段：例如在进食/休息完成时同步增减 `satiety`/`energy`，或废弃 `needs` 双写并全链路迁移到 `satiety`/`energy` + 派生压力值。
- [行动点 #0145]: 若行为上下文影响需求变化，将 `advanceNeeds` 的签名或调用方扩展为传入行为标签/活动类型，或在文档中明确「由上游将上下文折叠进 `ratesPerSecond`」，避免与设计表述长期歧义。
- [行动点 #0146]: 明确「饥饿阶段、疲劳阶段」的计算模块；若应在需求子系统内完成，可在本文件或邻接模块增加与阈值规则集一致的阶段推导，并与行为系统读取接口对齐。