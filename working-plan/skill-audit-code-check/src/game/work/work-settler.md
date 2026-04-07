# 审计报告: src/game/work/work-settler.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 伐木（`chop`）成功结算时仅派生拾取工单，未同时派生搬运工单或登记「后续搬运意图」。
- [依据]: 见 `oh-code-design/工作系统.yaml` 中「关键流程 → 伐木链路」：`伐木完成后触发木头生成` 之后要求 `生成拾取工作与搬运工作`。同文件「关键流程 → 自动生成拾取工作」亦写明：`若存在可用存储区，则同时登记后续搬运意图`。当前 `case "chop"` 仅调用 `generatePickUpWork` 与 `addWork`，未覆盖搬运链路。
- [指控]: 策划文档中伐木类型的目标结果状态为木头进入存储区；本文件结算阶段只保证进入「可拾取」派生步骤，未在结算层体现「至存储区」的闭环（与上条架构要求一致，属同一缺口在策划层的表述）。
- [依据]: 见 `oh-gen-doc/工作系统.yaml` 中「工作类型 → 伐木 → 结果状态: 木头物资在存储区中」及执行流程中「小人搬运物资到存储区」步骤；对比 `work-settler.ts` 中 `chop` 分支行为。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。（未出现 `mock`、`temp`、明显仅为兼容旧系统的分支或 TODO 式占位。）

## 3. 架构违规 (Architecture Violations)

- [指控]: `settleWorkSuccess` 在生命周期规则失败（如 `tree-transform-failed`、`construct-transform-failed`、`pick-up-failed`、`haul-drop-failed`）或前置不成立（如 `pick-up-missing-pawn`）时仅返回判别结果，不更新工单状态；与「工作结算器」应对执行结果做完成、失败或重开的职责不一致，且易使工单长期停留在 `claimed`（若调用方未另行调用 `settleWorkFailure`）。
- [依据]: 见 `oh-code-design/工作系统.yaml` 中「模块 → 工作结算器 → 职责」：`根据执行结果完成、失败或重开工作`、`处理目标消失、目标被占用等异常`。当前失败分支无对 `registry.orders` 的失败/重开写入。
- [说明]: 函数名暗示「成功」结算，但实际返回多种非 `ok` 结果；状态修复依赖调用方约定，而设计文档将「失败或重开」归于工作结算层，本实现将部分后果外推，边界与文档不完全对齐。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0185]: 在 `chop` 成功路径中，按 `oh-code-design/工作系统.yaml` 伐木链路补全「搬运工作」或「后续搬运意图」的生成/登记（需与 `工作编排器`、存储区查询能力对齐，避免在结算层硬编码半套逻辑）。
- [行动点 #0186]: 在 `settleWorkSuccess` 的失败分支中显式将工单置为设计所允许的状态（例如 `failed` 或回退 `open` 并写入 `lastFailureReason`），或保证文档级契约要求所有调用方在收到非 `ok` 时必须调用 `settleWorkFailure`，并在类型/命名上区分「仅应用实体变更的成功回调」与「完整结算」。
- [行动点 #0187]: 评估将 `asEntityId` 与工单字段结合的运行时校验（或上游保证），降低与工作单「目标实体标识」字段语义不一致时的静默错误风险（参见 `oh-code-design/工作系统.yaml` 核心数据「工作单」关键字段）。