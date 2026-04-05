---
name: route-demand
description: Use when Twist_V1 receives a new gameplay, interaction, rules, or multi-system requirement that must be split into subsystem aidocs before design, testing, or implementation.
---

# Route Demand

把新增玩法、改交互、扩系统、补规则这类需求先路由成可管理的子系统任务，再进入设计、TDD 和实现。本 Skill 只负责拆分和分派，不直接完成设计或实现。

分拆清单与注册表权威副本：

- `references/demand-router.md`
- `references/system-registry.md`
- `references/subagent-contract.md`
- `references/skill-tdd.md`

## Trigger

必须先走本 Skill：

- 新增玩法
- 新增 UI 交互或画面反馈
- 修改会影响两个及以上系统的需求
- 需要新 aidoc、拆多个子系统、或调用多个 SubAgent 的任务

不触发：单文件文案修正、纯样式微调且不新增交互、已有系统内部小型无争议 bugfix。

## Workflow

1. **提炼需求**：依次提取玩家目标 → 输入动作 → 画面反馈 → 状态承诺 → 边界条件（哪些可 fake/stub，哪些必须真实）。
2. **系统拆分**：满足任一条件时拆出独立系统——有独立玩家可见结果、需独立测试层级、假实现边界不同、修改会改另一系统接口。输出：目标系统、依赖系统、各目标系统的玩家可见结果、默认测试层级、共享 fake/stub 清单。
3. **查注册表**：从下方系统注册表读取标准文档路径、aidoc 路径、默认 failing test 层级。
4. **分派 SubAgent**：每个目标系统创建一个 SubAgent，下发内容和返回要求见下方契约。
5. **汇总**：等所有 aidoc 返回后，主 agent 写主控需求单、集成文档、TDD 顺序、fake-to-real 反推顺序。

## Required References

在执行前必须依次读取：

1. `references/demand-router.md`
2. `references/system-registry.md`
3. `references/subagent-contract.md`
4. `references/skill-tdd.md`

## 系统注册表

| system | 职责摘要 | 标准文档 | aidoc 路径 | 默认 failing test | 主要依赖 |
|---|---|---|---|---|---|
| world-grid | 格子地图尺寸、格坐标、邻格、边界、出生点、占用快照 | docs/ai/system-standards/world-grid.md | docs/ai/systems/world-grid/ | domain | pawn-state, task-planning |
| selection-ui | 选中、焦点、高亮、可点击反馈、目标切换 | docs/ai/system-standards/selection-ui.md | docs/ai/systems/selection-ui/ | acceptance | scene-hud, pawn-state |
| scene-hud | HUD、状态卡、菜单、按钮、场景内信息展示 | docs/ai/system-standards/scene-hud.md | docs/ai/systems/scene-hud/ | component | selection-ui, pawn-state |
| pawn-state | 角色可读状态、属性、需求、UI 派生字段 | docs/ai/system-standards/pawn-state.md | docs/ai/systems/pawn-state/ | domain | task-planning |
| task-planning | 目标评估、工作选择、任务计划、可执行动作候选 | docs/ai/system-standards/task-planning.md | docs/ai/systems/task-planning/ | domain | pawn-state |

- 必须从本表读取路径，不要凭记忆猜。
- 新 aidoc 文件写入表中声明的目录。
- 涉及新系统时先扩充本表再路由。

## SubAgent 契约

**主 agent 下发内容**：原始需求摘要、本系统负责的玩家可见结果、标准文档路径、aidoc 输出路径、默认 failing test 层级、已知 fake/stub 边界。

**SubAgent 必须执行**：

1. 阅读系统标准文档。
2. 只提炼本系统需要承诺的行为和边界。
3. 回写系统 aidoc，标注：前置依赖、输入、输出/反馈、假实现边界、最先失败的测试、最小通过实现、后续反推接口/规则。

**SubAgent 返回**：写入了哪个 aidoc 文件、首个 failing test 应测什么、还依赖主 agent 汇总哪些外部系统结果。

**禁止**：替其他系统补规格、擅改注册表、越过主 agent 决定跨系统接口、把未确认规则伪装成既定事实。

## Required Outputs

- `docs/ai/requests/<yyyy-mm-dd>-<topic>.md`
- `docs/ai/integration/<yyyy-mm-dd>-<topic>.md`
- `docs/ai/systems/<system>/<yyyy-mm-dd>-<topic>.md`

## Guardrails

- 不要跳过系统拆分直接写混合规格。
- 不要让 SubAgent 跨系统补写内容。
- 不要在全部 aidoc 返回前提前拍板跨系统接口。
- UI-first 需求允许 fake/stub，但必须在 aidoc 中显式登记。
- 真实领域规则由后续 domain TDD 接管，不要在路由阶段偷偷实现。
