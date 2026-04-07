# 需求系统 (Need System) 代码审计汇总报告

## 现状总结 (Current Status Summary)

目前需求系统的代码实现已具备基础的数值框架（如饱食度、精力值的快照与更新），但在与 `oh-code-design/需求系统.yaml` 及策划文档的设计对齐上存在明显的脱节，主要体现在以下几个方面：

1. **核心演化链路未接通 (Disconnected Evolution Pipeline)**
   - `need-evolution-engine.ts` 中基于行为上下文（如 idle, moving, working 等）的需求演化逻辑处于“已写好但未接入”的状态。当前主循环 (`sim-loop.ts`) 仅通过 `need-utils.ts` 的 `advanceNeeds` 按固定速率线性推进需求，未体现设计文档中要求的“根据行为上下文计算下降或恢复量”。
   - 昼夜时段对精力下降的影响尚未实现。

2. **数据源双写与不一致风险 (Data Source Inconsistency)**
   - 在交互结算（如进食、休息完成）时，`need-utils.ts` 仅累加了 `needs` 字段，而未同步更新实体状态 `PawnState` 上的权威字段 `satiety` 和 `energy`。这削弱了单一事实来源的原则。
   - `need-signals.ts` 仍依赖已标记为过渡期的 `PawnNeeds` 字段进行计算，未与 `satiety`/`energy` 主字段对齐。

3. **需求投影与规则硬编码 (Hardcoded Rules & Incomplete Projection)**
   - `need-signals.ts` 中仅处理了饥饿和疲劳，忽略了 `PawnNeeds` 中已存在的 `recreation`（娱乐）需求。
   - 警戒、紧急区间以及“是否允许打断工作”的阈值被硬编码为魔法数（甚至带有 mock 注释），未对接设计中要求的“需求规则配置”载体。

4. **打断工作流不完整与越权编排 (Incomplete Interrupt Flow & Architectural Violations)**
   - `need-interrupt-flow.ts` 仅实现了因饥饿打断工作去进食的流程，缺失了因疲劳打断工作去休息的对等流程。
   - 打断流程未严格遵循策划文档中“先移动去寻找食物/床铺，再进食/休息”的阶段语义，而是直接跳转状态。
   - 决策逻辑未尊重 `needActionSuggestion` 返回的 `allowInterrupt` 标志，且存在将评分逻辑与状态机、工作调度横向强耦合的问题，缺乏失败回滚机制。

5. **物理路径与职责边界模糊 (Path & Boundary Issues)**
   - `src/player/need-signals.ts` 作为二次导出入口，将需求投影能力挂载在 `player` 目录下，弱化了系统边界，且形成了不必要的并行导入面。

## 修改建议 (Modification Suggestions)

针对上述问题，建议按以下步骤进行重构与修复：

1. **统一需求演化入口 (Unify Need Evolution)**
   - 废弃双轨制，在模拟主循环中明确选用一条需求推进链路。建议将 `BehaviorState`（行为上下文）传入并调用 `evolveNeeds`，使需求的下降/恢复真正受当前行为驱动。
   - 明确进食/休息的恢复仅由“需求满足结算器”在交互完成时结算，或由演化引擎独占，避免双重累加。

2. **收敛核心数据模型 (Consolidate Data Model)**
   - 消除 `needs` 与 `satiety`/`energy` 的双写状态。全链路迁移到以 `satiety` 和 `energy` 为权威数据源，废弃过渡期的 `PawnNeeds` 相关结构。
   - 明确“饥饿阶段、疲劳阶段”的推导模块，确保与阈值规则集一致。

3. **数据化阈值规则与完善投影 (Data-Driven Rules & Complete Projection)**
   - 将警戒、紧急、打断等阈值从 `need-signals.ts` 中提取到统一的“需求规则配置”中，消除 mock 注释。
   - 在需求投影（`NeedSignalSnapshot`）中补充 `recreation`（娱乐）等其他需求的紧急度计算，或在文档中明确当前仅支持饥饿/疲劳。
   - 删除 `src/player/need-signals.ts` 这个无用的间接层，将 UI 的订阅直接指向 `game/need`。

4. **补全并规范需求打断流 (Complete & Standardize Interrupt Flow)**
   - 在 `need-interrupt-flow.ts` 中补全“因疲劳释放工单并转入休息”的流程。
   - 严格落实 `allowInterrupt` 标志的判断，只有当需求达到允许打断的阈值时才中断工作。
   - 梳理状态机切换链路，体现出 `working -> moving -> eating/resting` 的完整过程。
   - 增加异常处理机制，确保在 `releaseWork` 和状态切换之间的失败能够回滚，保证跨系统状态的原子性。