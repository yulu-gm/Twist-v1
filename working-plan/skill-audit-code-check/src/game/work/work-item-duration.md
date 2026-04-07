# 审计报告: src/game/work/work-item-duration.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: `WorkItemKind`（见 `src/game/work/work-types.ts`）包含 `deconstruct-obstacle`，但 `WORK_ITEM_ANCHOR_DURATION_SEC` 未配置该类型；`workItemAnchorDurationSeconds` 对其返回 `undefined`。结合 `src/game/world-work-tick.ts` 中 `tickAnchoredWorkProgress` 在 `duration === undefined` 时直接 `continue`、不调用 `completeWorkItem`，已认领的拆除工单无法通过「锚格四向邻接读条」路径进入结算闭环。
- [依据]: `oh-code-design/工作系统.yaml` 中「工作结算层」职责为「根据行为执行结果更新工作状态」「根据执行结果完成、失败或重开工作」；拆除类工单若无法触发读条落成，与该闭环不一致。另 `oh-gen-doc/工作系统.yaml` 对伐木、建造的「读条机制」写明「持续时间: 待定（需配置）」——同类读条应对所有需锚格读条落成的工作类型有可配置的耗时语义；本文件对 `deconstruct-obstacle` 缺失条目，与「可追踪、可完成」的工作单元目标（同文档工作队列/工作状态描述及设计侧目标）形成缺口。

- [指控]: 读条秒数为硬编码常量表，未接入 `oh-code-design/时间系统.yaml` 所述「时间配置」或统一耗时数据源（该设计强调游戏时间与读条、移动耗时的统一语义）。
- [依据]: `oh-code-design/时间系统.yaml`「核心数据」中「时间配置」关键字段含「现实时间与游戏时间比率」等；风险条款指出各系统自行累计耗时易导致时间语义分裂。当前工单锚格读条秒数仅驻留本模块，与上述统一配置方向未对齐。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- [指控]: 第 17 行将 `WORK_ITEM_ANCHOR_DURATION_SEC` 断言为 `Record<string, number | undefined>` 以支持对任意 `kind` 的动态索引，实质放宽了 `as const` 表的类型安全；属于为弥补「表未穷尽 `WorkItemKind`」而做的类型层面的兼容写法，而非业务 Mock。
- [影响]: 编译期不易发现「新增 `WorkItemKind` 却未补表」的疏漏（如 `deconstruct-obstacle`）。

- 未发现 `mock` / `temp` / `TODO` 等临时数据分支。

## 3. 架构违规 (Architecture Violations)

- [指控]: 工单锚格读条时长由 `src/game/work/` 内独立常量定义，未经「时间模型层 / 时间换算器」暴露的配置面，与 `oh-code-design/时间系统.yaml` 中「为工作系统提供读条与移动耗时基准」的分层意图存在潜在偏离（多源耗时定义）。
- [依据]: 同上「时间系统」分层与风险描述。

- 未发现本文件直接修改 `WorldCore`、越权调用 UI 或绕过工作结算 API 的违规；职责上仍为「工作类型 → 秒数」的纯函数与常量，与 `oh-code-design/工作系统.yaml`「工作模型层」定义工作类型相关数据的方向大体一致。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0169]: 为 `deconstruct-obstacle` 在 `WORK_ITEM_ANCHOR_DURATION_SEC` 中补充秒数（或与策划确认等价读条语义），并保证与 `tickAnchoredWorkProgress` 行为一致；或从类型上拆出「参与锚格读条的 Kind」子集，使未配置类型在类型层面即不可传入读条 tick。
- [行动点 #0170]: 将锚格读条时长迁入策划可读的配置（或时间系统配置结构），与 `oh-gen-doc/工作系统.yaml` 中「持续时间: 待定（需配置）」的表述对齐，避免魔法数分散。
- [行动点 #0171]: 收紧 `workItemAnchorDurationSeconds` 的返回类型与实现（例如对 `WorkItemKind` 做穷尽映射或使用 satisfies），避免依赖 `Record<string, …>` 宽化掩盖漏配项。