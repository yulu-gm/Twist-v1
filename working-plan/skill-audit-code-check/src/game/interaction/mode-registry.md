# 审计报告: src/game/interaction/mode-registry.ts

## 1. 漏做需求 (Missing Requirements)

- [指控]: 默认注册的模式集合未包含策划与架构文档明确列出的「物资拾取 / 拾取标记」类交互模式；`seedDefaultModes` 仅注册存储区、伐木、墙蓝图、床铺四类，缺少与「框选物资 → 标记可拾取」对应的模式及解释规则。
- [依据]: `oh-gen-doc/交互系统.yaml` 中「交互模式 → 物资拾取标记模式」整节（触发、框选散落物资、标记为可拾取）；`oh-code-design/交互系统.yaml` 中「交互模式层」职责列举含「拾取标记」，且「交互命令生成器」职责含「将模式结果转成……标记物资……等领域命令」。

- [指控]: 伐木相关模式的标识与领域动词与 UI/命令菜单及领域应用层不一致：本文件使用 `modeId` / `itemId` / `sourceMode.source.itemId` 为 `chop`，动词为 `assign_tool_task:chop`；而 `src/data/command-menu.ts` 中伐木命令的 `modeKey` 为 `lumber`、`domainVerb` 为 `assign_tool_task:lumber`，`src/player/apply-domain-command.ts` 以 `toolId === "lumber"` 分支处理伐木。若会话层按菜单 `modeKey` 查表或按菜单动词对齐回放，将与本注册表默认项冲突或无法命中。
- [依据]: `oh-gen-doc/UI系统.yaml`「工具栏/交互组件 → 伐木工具」与 `oh-gen-doc/交互系统.yaml`「伐木标记模式」描述的是同一玩法能力；实现上应以单一、贯穿菜单—模式—领域动词的命名为准，当前注册表与数据层命名分裂。

- [指控]: `oh-code-design/交互系统.yaml` 规定「模式注册表」职责包含定义各模式的「进入条件、退出条件、输入规则」。当前 `InteractionMode` 仅结构化承载 `explainRule`（输入解释）与 `inputShape` 等，未体现进入/退出条件（无字段、无约定由谁实现），与设计中的「模式注册表」职责不完全对齐。
- [依据]: `oh-code-design/交互系统.yaml`「模块 → 模式注册表 → 职责」三条 bullet 中的进入条件、退出条件、输入规则；本文件对应「输入规则」中的解释部分，进入/退出未在注册表层表达。

- [说明]: 命令菜单中还定义了开采、拆除、割草、耕种、巡逻等矩形选区类工单（`command-menu.ts`），本注册表未预置对应 `InteractionMode`；是否属「首日范围裁剪」应以文档或注释与策划对齐，否则与 `oh-gen-doc/UI系统.yaml` 工具栏范围相比仍属能力缺口（次要，同上仍以交互/ UI 文档为据）。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- 未发现明显问题。（本文件无 `mock`/`temp`/`TODO` 残留，亦无仅为兼容旧路径而存在的死分支。）

## 3. 架构违规 (Architecture Violations)

- 未发现明显问题。（本模块位于交互子系统内，通过 `explainRule` 产出领域命令载荷，不直接修改地图/实体/工作等核心可变状态，与 `oh-code-design/交互系统.yaml` 中「交互意图层 / 交互命令生成器」方向一致。）

- [轻微说明]: `ModeRegistry` 类型外层为 `Readonly`，但 `registerMode` 对内部 `Map` 进行可变写入，属于 TypeScript 表达力下的只读语义不完全封闭，不构成跨层越权，但可读性上易误导「注册表不可变」。

## 4. 修复建议 (Refactor Suggestions)

- [行动点 #0108]: 在默认模式列表中增加与策划一致的「物资拾取标记」模式（`modeKey` / `modeId` 与 `command-menu` 中 `haul` 及 `assign_tool_task:haul` 对齐），`explainRule` 产出与 `apply-domain-command` 或既有任务标记链路一致的 `verb` 与 `sourceMode` 元数据。
- [行动点 #0109]: 将伐木模式的 `modeId`、`interactionSource.itemId` 与 `verb` 后缀与 `command-menu` 的 `lumber` / `assign_tool_task:lumber` 统一，避免会话入口与领域处理分叉。
- [行动点 #0110]: 在设计或实现二选一处收敛「进入条件 / 退出条件」：`InteractionMode` 增加可选元数据（或明确注释「由会话管理器与 UI 状态机实现，注册表仅登记解释规则」），并与 `oh-code-design/交互系统.yaml`「模式注册表」职责表述一致。