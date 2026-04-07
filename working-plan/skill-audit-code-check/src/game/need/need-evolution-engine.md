# 审计报告: src/game/need/need-evolution-engine.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 本文件实现的「按当前行为状态结算饱食/精力变化」主入口 `evolveNeeds` 在 `src/` 内无任何调用方；主模拟路径未使用行为分档速率。
- [依据]: `oh-code-design/需求系统.yaml` 中模块「需求演化引擎」职责写明「根据行为上下文计算下降或恢复量」；关键流程「时间驱动需求下降」步骤包含「需求演化引擎按小人当前行为结算需求变化」。当前 `src/game/behavior/sim-loop.ts` 在 tick 阶段 1 使用 `advanceNeeds(pawn, simulationDt, config.needGrowthPerSec)`（`src/game/need/need-utils.ts`），仅按 `SimConfig.needGrowthPerSec` 固定速率推进，未传入 `BehaviorState`，也未调用 `evolveNeeds`。

- [指控]: 行为相关的消耗/恢复语义（idle / moving / working / eating / resting / wandering）在仓库内未通过本引擎接入运行时，与设计「行为上下文驱动」存在实现缺口。
- [依据]: 同上「需求演化引擎」职责；对比本文件 `DEFAULT_EVOLUTION_BY_BEHAVIOR` 与 `sim-loop` 实际推进路径可证行为表处于未接线状态。

- [指控]: `oh-gen-doc/需求系统.yaml` 中精力机制描述「在白天活动时随时间自然下降」；本引擎的速率常量未接收昼夜或时段输入，且当前主循环的需求推进亦未结合时段（`sim-loop` 中 `timePeriod` 用于阶段 3 决策，不用于 `advanceNeeds`）。
- [依据]: `oh-gen-doc/需求系统.yaml`「需求类型 → 精力值 → 机制」；若仅以本文件为审计对象，可记为与设计叙述尚未对齐的扩展点（完整时段逻辑也可能归属时间系统与其它模块，但本引擎 API 未预留时段参数）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：文件中无 `mock`、`temp`、`TODO` 等临时分支；`EvolveNeedsOptions.ratesByBehavior` 属于正当扩展接口。

- [指控]: `evolveNeeds`、`DEFAULT_EVOLUTION_BY_BEHAVIOR`（除被其它模块引用的导出常量外）在运行路径上处于「已写好但未接入」状态，与 `satisfaction-settler` 仅共享 `EATING_SATIETY_RECOVERY_PER_SECOND`、`RESTING_ENERGY_RECOVERY_PER_SECOND` 两处常量；行为分档表本身对当前主循环无实际作用。
- [影响]: 易形成双轨语义：`pawn-state`/`need-utils` 的 `advanceNeeds` 与 `need-profile`+`evolveNeeds` 两套时间推进若未来同时启用，需严格约定唯一数据源，否则易出现重复结算或数值不一致。

## 3. 架构违规 (Architecture Violations)

- [指控]: 设计文档将「需求演化引擎」与「需求满足结算器」分列为不同模块；本文件在 `eating`/`resting` 行为下直接编码饱食/精力的净变化，而 `src/game/need/satisfaction-settler.ts` 亦通过相同常量对进食/休息做按秒结算。职责边界上，「时间片上的行为态演化」与「满足行为的持续结算」在设计流程中分为不同关键流程（`oh-code-design/需求系统.yaml`「进食恢复」「睡眠恢复」对应需求满足结算器；「时间驱动需求下降」对应演化引擎）。当前实现把恢复速率既放在演化默认表又放在结算器中，若未来在同一 tick 既调用 `evolveNeeds` 又调用 `settleEating`/`settleResting`，可能违背设计上的流程分离意图并导致数值叠加。
- [依据]: `oh-code-design/需求系统.yaml` 模块「需求演化引擎」「需求满足结算器」及关键流程「时间驱动需求下降」「进食恢复」「睡眠恢复」的分工描述。

- [指控]: 从数据流看，设计期望的「时间系统推进 → 演化引擎按行为结算」链路未成立；实际 tick 走 `need-utils.advanceNeeds`，使 `need-evolution-engine` 中的行为驱动模型与运行架构脱节，属于对 `oh-code-design` 分层中「需求计算层 / 演化引擎」路径的偏离。
- [依据]: `oh-code-design/需求系统.yaml` 分层「需求计算层」职责与关键流程「时间驱动需求下降」；对照 `sim-loop.ts` 与 `need-utils.ts` 调用关系。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0138]: 在模拟主循环（或唯一的需求 tick 入口）中明确选用一条需求推进链路：要么将 `BehaviorState`（或与之等价的行动语义）传入并调用 `evolveNeeds`（基于 `NeedSnapshot`/`need-profile`），要么删除/合并未使用的引擎表，避免长期双轨。
- [行动点 #0139]: 若保留 `evolveNeeds` 作为权威时间推进，应规定进食/休息的恢复仅由「需求满足结算器」在交互/读条完成路径结算，或由演化引擎独占 tick 内恢复，并在文档或单测中禁止双重调用；并与 `oh-code-design/需求系统.yaml` 中三条关键流程的边界对齐。
- [行动点 #0140]: 若需满足策划文档中昼夜对精力下降的差异，应在时间系统与需求计算之间增加显式输入（参数或策略），而非仅依赖固定常数表。