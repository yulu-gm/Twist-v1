# 审计报告: src/headless/scenario-observers.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `VisibleWorkItemSnapshot` 与 `captureVisibleState` 仅暴露工单 `id/kind/status/claimedBy/failureCount/anchorCell`，未承载读条或执行进度；与 `oh-gen-doc/UI系统.yaml` 中「进度条：显示工作进行进度（伐木读条、建造读条）」及 `oh-code-design/UI系统.yaml`「状态展示模型：聚合多个系统的只读字段」「接口边界：来自行为系统的行为标签与进度」相比，headless 侧缺少用于对齐该可见性需求的观察字段，现有 `assertVisibleWorkItemState` 也无法断言进度类期望。
- [依据]: `oh-gen-doc/UI系统.yaml`「进度条」小节；`oh-code-design/UI系统.yaml` 中「状态展示模型」职责与「接口边界」输入列表。
- [指控]: 工单失败在 `failures` 中仅以 `failureCount` 生成固定英文模板 `work ${id} failure-count …`，未反映 `oh-gen-doc/工作系统.yaml` 对工作失败语义的描述（如目标消失等具体原因），与 `oh-code-design/工作系统.yaml`「工作结算层：根据执行结果完成、失败或重开工作」「输出：提供给 UI 系统的工作状态」所隐含的可诊断反馈相比，场景断言只能验证「失败次数」而无法对齐失败类型的验收表达。
- [依据]: `oh-gen-doc/工作系统.yaml`「工作状态 / 失败」；`oh-code-design/工作系统.yaml`「工作结算层」与「接口边界 / 输出」。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题：文件中无 `mock`、`temp`、`TODO` 等临时桩，亦无明显仅为兼容已删除入口的死分支。
- [说明]: `resolveScenarioPlayerInputSemantic` 使用 `selection.semantics ?? selection.inputShape`，与 `scenario-types.ts` 中 `semantics` 为可选字段的定义一致，属于场景 DSL 的显式默认语义，不宜等同于「无用兼容」；若未来场景定义规范强制总是填写 `semantics`，可再评估是否收紧。

## 3. 架构违规 (Architecture Violations)

- [指控]: `captureVisibleState` 名称与 `VisibleStateSnapshot` 暗示「当前世界可见态」，但 `failures` 中 `layer: "player-channel"` 分支完全依赖调用方传入的 `options.playerSelections`（先前几步提交结果的回放），并非从 `sim.getWorldPort().getWorld()` 只读投影；与 `oh-code-design/UI系统.yaml`「界面状态层：订阅领域系统只读数据并转成界面态」「以读模型驱动展示」的理想单一数据源相比，存在**测试夹具状态**与**领域只读快照**的混编。
- [依据]: `oh-code-design/UI系统.yaml`「分层 / 界面状态层」与「目标」中「以读模型驱动展示，避免 UI 直接承担领域规则」（此处类比：观察层宜区分「世界读模型」与「渠道回放」）。
- [说明]: 其余逻辑仅读取 `world.time`、`world.workItems`、`world.entities`，未直接篡改领域状态，不构成越权写回。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0224]: 若需对齐策划文档中的进度可见性：在领域 `WorkItemSnapshot`（或并行工作模型）具备进度字段后，扩展 `VisibleWorkItemSnapshot` 与 `assertVisibleWorkItemState`，使 headless 断言可覆盖 `oh-gen-doc/UI系统.yaml` 中的读条/进度场景。
- [行动点 #0225]: 若需断言失败类型：在世界模型或结算路径上暴露稳定、可序列化的失败原因（或失败码），再在 `captureVisibleState` 中映射到 `failures` 或独立字段，替代仅依赖 `failureCount` 的模板文案。
- [行动点 #0226]: 为厘清分层语义：可将「世界可见快照」与「玩家渠道回放」拆成两个函数或两个子对象（例如 `captureWorldVisibleState` 与 `appendPlayerChannelFailures`），避免单一 `VisibleStateSnapshot` 混合两种数据来源，便于与 `oh-code-design/UI系统.yaml` 的分层叙述对照维护。