# 审计报告: src/game/behavior/behavior-state-machine.ts

## 1. 漏做需求 (Missing Requirements)

- **[指控]**：`BehaviorFSM` 与 `oh-code-design/行为系统.yaml` 中「行为快照」关键字段不对齐；设计明确列出当前主状态、**当前子状态**、**当前目标**、是否可被打断等，而本文件导出的 FSM 仅包含 `pawnId`、`currentState`、`lockedUntilInterruptPriority`，未承载子状态与目标引用，「可打断」也未作为快照字段而是由 `canBeInterrupted` 即时计算。
- **[依据]**：`oh-code-design/行为系统.yaml` → `核心数据` → `行为快照` → `关键字段`（当前主状态、当前子状态、当前目标、是否可被打断）。

- **[指控]**：设计中的行为状态机应「表达移动中、伐木中、建造中、进食中、休息中等状态」并维护子状态细节；本文件将 `eating` / `resting` / `working` 建模为平级主状态，**未在本模块体现** `oh-gen-doc/行为系统.yaml` 所述执行工作下的子状态（伐木中、建造中、拾取中、放置中）及满足需求下的子状态划分。
- **[依据]**：`oh-code-design/行为系统.yaml` → `模块` → `行为状态机` → `职责`；`oh-gen-doc/行为系统.yaml` → `小人状态机` → `执行工作状态` / `满足需求状态` 的 `子状态` 描述。

- **[指控]**：设计侧「行为状态机层」需维护进入、退出、中断条件；本文件运行时仅校验**邻接合法边**与**打断锁**，不校验 `DEFAULT_BEHAVIOR_TRANSITIONS` 中的 `condition` / `predicateHint`，也不校验 `oh-gen-doc` 中诸如「目标失效」退出移动等语义。若上层未统一承接谓词，易出现「图论上合法、策划语义不合法」的转移。（本项为衔接风险：不一定算本文件单独漏做，但与设计表述存在差距。）
- **[依据]**：`oh-code-design/行为系统.yaml` → `分层` → `行为状态机层` → `职责`；`oh-gen-doc/行为系统.yaml` → `状态转换规则` 与各状态 `进入条件` / `退出条件`。

## 2. 无用兼容与 Mock (Useless Compatibility & Mocks)

- **[指控]**：`DEFAULT_BEHAVIOR_TRANSITIONS` 注释写明为「策划/文档用」且 `condition`、部分 `interruptPriority` 为**示意**；与 `ALLOWED_TARGETS` 形成**双轨**维护，运行路径 `canTransition` / `transition` **完全不读取**该数组。长期易产生「文档边集与真实合法边集漂移」的维护负担，性质上接近冗余/半文档化数据而非生产校验链。
- **[影响]**：阅读者易误以为转移需满足表中条件或优先级；实际仅以邻接表 + `lockedUntilInterruptPriority` + `TransitionContext` 为准。

- 未发现 `mock` / `temp` / `TODO` 等典型临时桩代码。

## 3. 架构违规 (Architecture Violations)

- **[指控]**：`oh-code-design` 强调行为选择「可重放、可测试」；`transition` 对传入的 `BehaviorFSM` **原地突变** `currentState` 与锁字段，若系统期望以不可变快照做历史回放，则与理想架构存在张力。（是否违规取决于项目是否在别处用事件溯源/拷贝快照规避；本文件自身未提供不可变转移 API。）
- **[依据]**：`oh-code-design/行为系统.yaml` → `目标`（可解释、可重放、可测试）。

- 本文件未直接依赖 UI、地图或工作实现，分层上仍属「行为状态机」纯逻辑，**未发现**越权修改其它子系统数据的违规。

## 4. 修复建议 (Refactor Suggestions)

- **[行动点 #0035]**：在文档或类型层对齐「行为快照」：要么扩展 `BehaviorFSM`（或并列导出 `BehaviorSnapshot`）纳入子状态、目标句柄/ID、可打断摘要；要么在 `oh-code-design` 中明确这些字段由**上层聚合结构**持有，并注明本模块仅为图转移内核，避免设计与实现双解。

- **[行动点 #0036]**：为工作/进食/休息子状态选定落点：在状态机中增加 `subState` 枚举，或将子状态归属「行为执行协调层」并在审计边界中写清；避免策划文档中的子状态长期无代码锚点。

- **[行动点 #0037]**：消除 `DEFAULT_BEHAVIOR_TRANSITIONS` 与 `ALLOWED_TARGETS` 漂移风险：由单一数据源生成邻接表与文档用边列表，或弃导出一方并在注释中明确「仅 ALLOWED_TARGETS 为运行时真源」。

- **[行动点 #0038]**：若重放为硬需求：提供返回新 FSM 对象的 `transition` 变体，或要求调用方在转移前克隆快照；与现有原地 API 并存时需在 `oh-code-design` 中约定唯一标准用法。
