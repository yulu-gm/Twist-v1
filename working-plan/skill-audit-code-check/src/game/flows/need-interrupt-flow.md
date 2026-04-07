# 审计报告: src/game/flows/need-interrupt-flow.ts

## 1. 漏做需求 (Missing Requirements)

- **[指控]**：策划与架构均把「需求打断」表述为**先放弃工作、再移动去寻找食物或床铺**，再进入满足需求子状态；本文件在 `handleNeedInterruptTick` 中在 `working` 上直接 `transition(..., "eating", …)`，未体现「前往食物/床铺」的 `moving` 阶段语义。
- **[依据]**：`oh-gen-doc/行为系统.yaml` 中「任意状态 -> 移动 (需求打断)」写明目标为放弃当前工作并**移动去寻找食物或床铺**；`oh-code-design/行为系统.yaml` 关键流程「工作被需求打断」步骤含「状态机切换为**前往食物或床铺**」。

- **[指控]**：`oh-code-design/行为系统.yaml` 与 `oh-gen-doc/行为系统.yaml` 均将饥饿与疲劳并列为高优先级需求；`needActionSuggestion`（`threshold-rules`）可返回 `rest`。本模块名与常量（如 `NEED_INTERRUPT_TO_EAT_PRIORITY`）、`eatPreferredOverWork` 及 `runNeedInterruptScenario` 的进食结算仅覆盖**饥饿→进食**，未实现**工作中因疲劳优先而释放工单并转入休息**的等价流程。
- **[依据]**：`oh-gen-doc/行为系统.yaml`「执行工作状态」退出条件含被高优先级需求打断；`oh-code-design/行为系统.yaml`「工作被需求打断」与需求侧输出一致指向食物**或**床铺。

- **[指控]**：`oh-code-design/需求系统.yaml` 中「需求行动建议」关键字段含「是否允许打断当前工作」。`eatPreferredOverWork` 仅根据建议行动是否为 `eat` 或评分首位是否为 `eat` 判断，**未读取** `needActionSuggestion(profile).allowInterrupt`，可能在仅处于警戒（非 critical）阶段时仍打断工作，与需求规则中 `allowInterrupt` 语义不一致。
- **[依据]**：`oh-code-design/需求系统.yaml` 核心数据「需求行动建议」及模块「阈值规则集」职责（将数值转译为决策优先级，含是否允许打断）。

- **[指控]**：`eatPreferredOverWork` 使用逻辑或：`suggestion.actionKind === "eat" || ranked[0]?.kind === "eat"`。当建议为 `rest`（疲劳更紧迫）但评分器仍把 `eat` 排第一时，会走向进食打断，与 `needActionSuggestion` 的「同级比较缺口」裁决可能冲突。
- **[依据]**：`oh-code-design/行为系统.yaml`「行为决策层」职责为依据优先级规则选择行动；需求侧 `threshold-rules` 对吃/睡并列时的主建议应与决策结果一致（本处未保证）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- **[指控]**：`defaultNeedInterruptScoringContext` 将当前工单拷贝为 `status: "open"` 并固定 `time`、`map`（`foodReachable: true` 等），属于为 `scoreActions` **人造**决策快照，而非从「行为上下文汇总器」读取的真实地图与时间语境。
- **[影响]**：调用方若在生产路径误用该默认值，会得到「食物总可达、正午、工单在候选里呈 open」的评分结果，与 `oh-code-design/行为系统.yaml` 中「行为上下文汇总器」从地图与时间系统汇总的职责不符；更适合作为测试/调试辅助并在命名或文档上严格限定范围（当前注释已部分说明意图，但数据形态仍属简化 Mock）。

- **[其他]**：未发现 `TODO`/`temp`/显式废弃分支；`runNeedInterruptScenario` 用 `settleEating` 推进饱食度属于场景级合成步骤，需调用方理解其用于可重放测试或编排演示，而非完整仿真「移动+进食」链路。

## 3. 架构违规 (Architecture Violations)

- **[指控]**：单文件串联 `scoreActions`（行为决策）、`canBeInterrupted`/`transition`（状态机）、`releaseWork`/`claimWork`（工作调度）、`settleEating`（需求结算），属于**横向编排**。若项目约定「行为执行协调层」为唯一对外编排出口，则此处可能使主循环或调用方绕过该层直接驱动多子系统；需与仓库内其它 flow 的归口方式对照（本报告仅指出与设计分层的张力）。
- **[依据]**：`oh-code-design/行为系统.yaml` 分层中的「行为决策层」「行为状态机层」「行为执行协调层」及接口边界（向工作系统回报、向需求系统声明等）强调职责拆分。

- **[指控]**：`handleNeedInterruptTick` 在调用 `releaseWork` 之后若 `transition(fsm, "eating", …)` 失败会 `throw`，此时工单已释放而状态机可能仍停留在 `working`，存在**跨系统状态短暂不一致**风险；设计侧强调工作状态与因果清晰，异常路径应有明确补偿策略（本文件未提供）。
- **[依据]**：`oh-code-design/工作系统.yaml` 目标中「保证工作状态与实体变化之间的因果关系清晰」；`oh-code-design/行为系统.yaml` 状态机层维护转换与中断条件。

## 4. 修复建议 (Refactor Suggestions)

- **对齐策划链路**：在整体行为管线中明确 `working → moving`（目标=食物/床）再 `eating/resting` 是否由其它模块承接；若本 flow 仅负责「释放+意图切换」，应在注释或与 `DEFAULT_BEHAVIOR_TRANSITIONS` 的文档交叉说明，避免与 `oh-gen-doc`「先移动再找食物」字面矛盾。

- **扩展需求类型**：在统一入口为「需求打断工作」时，为 `rest` 增加与 `eating` 对称的释放工单、`resting` 转移及恢复后 `claimWork` 的路径，并复用与工作系统一致的优先级常量。

- **尊重 `allowInterrupt`**：在 `handleNeedInterruptTick` 中于 `eatPreferredOverWork` 之前或之后合并 `needActionSuggestion(profile).allowInterrupt === false` 时直接返回新结果种类（如 `need-not-urgent-enough-to-interrupt`），与 `oh-code-design/需求系统.yaml` 中需求行动建议字段对齐。

- **统一吃/睡裁决**：避免 `suggestion.actionKind === "rest"` 时仍因 `ranked[0] === "eat"` 进入进食打断；可改为以建议为主、评分仅在工作 vs 当前建议行动之间比较，或明确文档化「评分器可覆盖建议」的产品规则。

- **收紧默认上下文**：将 `defaultNeedInterruptScoringContext` 移至测试工具或标注 `@internal`/仅限 spec，避免与真实「汇总器」混用；或改为接受注入的 `BehaviorContext` 片段。

- **失败原子性**：`releaseWork` 与 `transition` 之间若失败，应约定回滚（重新 claim 或把工作置回可认领）或上升为可恢复错误类型，避免仅 `throw` 留下半完成副作用。
