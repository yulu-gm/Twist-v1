---
name: route-demand
description: Use when Twist_V1 receives a new gameplay, interaction, rules, or multi-system requirement that must be routed through the 9 top-level oh-doc systems before design, acceptance, testing, or implementation.
---

# Route Demand

把新增玩法、改交互、扩系统、补规则这类需求，先路由成可管理的 9 子系统文档更新任务，再进入设计、验收、TDD 和实现。本 Skill 只负责拆分、编排和记录，不直接代替 `oh-gen-doc`、`oh-code-design`、`oh-acceptance` 或实现阶段。

分拆清单与权威副本：

- `references/demand-router.md`
- `references/system-registry.md`
- `references/subagent-contract.md`
- `references/skill-tdd.md`

## Trigger

必须先走本 Skill：

- 新增玩法
- 新增 UI 交互或画面反馈
- 修改会影响两个及以上系统的需求
- 需要同步 `oh-gen-doc`、`oh-code-design`、`oh-acceptance` 其中两层及以上的任务
- 需要拆多个子系统、或调用多个 SubAgent 的任务

不触发：单文件文案修正、纯样式微调且不新增交互、已有系统内部小型无争议 bugfix。

## Workflow

1. **提炼需求**：依次提取玩家目标 → 输入动作 → 画面反馈 → 状态承诺 → 边界条件（哪些可 fake/stub，哪些必须真实）。
2. **系统拆分**：从 9 个顶层系统中识别目标系统与依赖系统。输出：影响系统、各系统负责的玩家可见结果、需要补的 `oh-gen-doc` / `oh-code-design` / `oh-acceptance`、默认验证层级、共享 fake/stub 清单。
3. **查注册表**：从 `references/system-registry.md` 读取每个系统对应的结构化文档路径、主要代码目录、默认验证层级和上游依赖。
4. **分派 SubAgent**：每个目标系统创建一个 SubAgent，下发内容和返回要求见 `references/subagent-contract.md`。
5. **汇总主控路由单**：等各系统建议返回后，主 agent 写 `working-plan/route-demand/<yyyy-mm-dd>-<topic>.md`，整理影响系统矩阵、文档更新顺序、跨系统依赖、fake/stub 边界、测试入口建议、进入实现前检查项。
6. **进入下游链路**：路由完成后，严格按 `oh-gen-doc -> oh-code-design -> oh-acceptance -> TDD/实现` 顺序推进；不要在路由阶段跳过前置文档直接写代码。

## Required References

在执行前必须依次读取：

1. `references/demand-router.md`
2. `references/system-registry.md`
3. `references/subagent-contract.md`
4. `references/skill-tdd.md`

## 顶层系统

`route-demand` 只允许把需求路由到以下 9 个一级系统：

- `UI系统`
- `交互系统`
- `地图系统`
- `实体系统`
- `工作系统`
- `建筑系统`
- `时间系统`
- `行为系统`
- `需求系统`

不要把新需求重新折叠回旧的 `world-core`、`task-planning`、`scene-hud`、`selection-ui` 等历史路由目标。

## 系统注册表

| system | oh-gen-doc | oh-code-design | oh-acceptance | 主要代码目录 | 默认验证层级 | 上游依赖 |
|---|---|---|---|---|---|---|
| UI系统 | oh-gen-doc/UI系统.yaml | oh-code-design/UI系统.yaml | oh-acceptance/UI系统.yaml | src/ui/, src/scenes/, src/data/ | component / acceptance | 交互系统, 时间系统, 行为系统, 地图系统, 实体系统 |
| 交互系统 | oh-gen-doc/交互系统.yaml | oh-code-design/交互系统.yaml | oh-acceptance/交互系统.yaml | src/game/interaction/, src/player/, src/scenes/ | domain / integration | UI系统, 地图系统, 建筑系统 |
| 地图系统 | oh-gen-doc/地图系统.yaml | oh-code-design/地图系统.yaml | oh-acceptance/地图系统.yaml | src/game/map/, src/scenes/renderers/ | domain / integration | 实体系统, 建筑系统, 交互系统 |
| 实体系统 | oh-gen-doc/实体系统.yaml | oh-code-design/实体系统.yaml | oh-acceptance/实体系统.yaml | src/game/entity/, src/game/world-core.ts | domain | 地图系统, 建筑系统, 工作系统, 需求系统 |
| 工作系统 | oh-gen-doc/工作系统.yaml | oh-code-design/工作系统.yaml | oh-acceptance/工作系统.yaml | src/game/work/, src/game/flows/ | domain / integration | 实体系统, 建筑系统, 行为系统 |
| 建筑系统 | oh-gen-doc/建筑系统.yaml | oh-code-design/建筑系统.yaml | oh-acceptance/建筑系统.yaml | src/game/building/, src/game/flows/build-flow.ts | domain / integration | 地图系统, 实体系统, 工作系统, 交互系统 |
| 时间系统 | oh-gen-doc/时间系统.yaml | oh-code-design/时间系统.yaml | oh-acceptance/时间系统.yaml | src/game/time/, src/scenes/renderers/ | domain | 行为系统, 需求系统, UI系统 |
| 行为系统 | oh-gen-doc/行为系统.yaml | oh-code-design/行为系统.yaml | oh-acceptance/行为系统.yaml | src/game/behavior/, src/game/game-orchestrator.ts, src/game/flows/ | domain / integration | 需求系统, 工作系统, 时间系统, 实体系统 |
| 需求系统 | oh-gen-doc/需求系统.yaml | oh-code-design/需求系统.yaml | oh-acceptance/需求系统.yaml | src/game/need/, src/game/pawn-state.ts | domain | 时间系统, 行为系统, 实体系统 |

- 必须从本表读取路径，不要凭记忆猜。
- 如果系统文件缺失，先补齐 `oh-gen-doc`、`oh-code-design`、`oh-acceptance` 的同名文档，再继续路由。
- 若系统存在，但本次需求不产生新承诺，可以只在主控路由单中标记为依赖系统。

## SubAgent 契约

**主 agent 下发内容**：原始需求摘要、本系统负责的玩家可见结果、对应的 `oh-gen-doc` / `oh-code-design` / `oh-acceptance` 路径、默认验证层级、主要代码目录、已知 fake/stub 边界、被哪些上游系统阻塞。

**SubAgent 必须执行**：

1. 阅读本系统对应的 `oh-gen-doc`、`oh-code-design`、`oh-acceptance`。
2. 只提炼本系统需要更新的行为、边界和验证点。
3. 返回一份文档更新建议包，至少包含：
   - `system`
   - `why_impacted`
   - `upstream_docs_to_update`
   - `code_design_sync_points`
   - `acceptance_sync_points`
   - `recommended_first_test`
   - `blocked_by`

**禁止**：替其他系统补规格、擅改系统注册表、越过主 agent 决定跨系统接口、把未确认规则伪装成既定事实。

## Required Outputs

- `working-plan/route-demand/<yyyy-mm-dd>-<topic>.md`

主控路由单必须包含：

- 需求摘要
- 影响系统矩阵
- 各系统的文档更新顺序
- 跨系统依赖
- fake/stub 边界
- 测试入口建议
- 进入实现前检查项

## Guardrails

- 不要跳过系统拆分直接写混合规格。
- 不要把多个一级系统重新折叠回旧的历史 system key。
- 不要让 SubAgent 跨系统补写内容。
- 不要在全部系统建议返回前提前拍板跨系统接口。
- UI-first 需求允许 fake/stub，但必须在主控路由单中显式登记。
- `oh-gen-doc` 是需求事实源，`oh-code-design` 承接代码设计，`oh-acceptance` 承接验收；路由阶段不要越权代写实现。
