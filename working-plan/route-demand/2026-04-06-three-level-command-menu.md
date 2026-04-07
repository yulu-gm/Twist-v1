# 三级命令菜单重构路由单

## 需求摘要

- 玩家目标：把当前底部扁平工具栏重构为三级命令菜单。
- 输入动作：通过底部菜单入口打开命令面板，按一级/二级/三级路径选择命令，并保持当前命令高亮与持续生效。
- 画面反馈：新菜单替代 `villager-tool-bar`；分类、命令、当前模式提示必须同步。
- 状态承诺：菜单状态与当前命令可在折叠/重开之间保留；地图输入形态继续沿用现有 `rect-selection` / `brush-stroke` / `single-cell`。
- fake/stub 边界：本轮只重构命令入口与模式映射，优先复用现有 `verb` / tool / mode 语义，不扩写新领域规则。

## 路由包

### 1. UI系统

- `system`: UI系统
- `why_impacted`: 当前实现是 `villager-tool-bar` 扁平槽位加 `build` 特例子菜单；新需求要求统一成三级菜单树，属于 HUD 结构、菜单状态、高亮与可见反馈的直接改动。
- `upstream_docs_to_update`:
  - `oh-gen-doc/UI系统.yaml`
  - `oh-code-design/UI系统.yaml`
  - `oh-acceptance/UI系统.yaml`
- `code_design_sync_points`:
  - 把“菜单树”从现有概念位升级为真实三层读模型，替代 `selectedToolIndex` 为主的 UI 状态。
  - 定义一级入口、二级分类、三级命令、展开/折叠、当前命令持久化、返回路径与高亮规则。
  - 明确 `player-channel-hint`、菜单高亮、底栏布局和 DOM/ARIA 结构的同步边界。
- `acceptance_sync_points`:
  - 玩家可以通过三级路径进入命令，且当前分类/命令高亮正确。
  - 菜单折叠后重新打开，当前命令与模式提示保持一致。
  - 不再允许“建造”作为 HUD 特例子菜单；所有命令走统一树结构。
- `recommended_first_test`: `tests/scene-hud-markup.test.ts`
- `blocked_by`:
  - 需要先定清菜单信息架构：一级/二级/三级的最终命名和叶子命令集合。
  - 需要交互系统提供“命令节点 -> 输入形态/模式提示/命令语义”的单一映射源，避免 UI 自己推断。

### 2. 交互系统

- `system`: 交互系统
- `why_impacted`: 当前交互状态由 `selectedToolIndex + buildSubTool` 和若干 toolbar/toolId 约定驱动；三级菜单上线后，模式来源必须改为“命令路径/命令 id”，否则 UI 与地面交互会双写状态。
- `upstream_docs_to_update`:
  - `oh-gen-doc/交互系统.yaml`
  - `oh-code-design/交互系统.yaml`
  - `oh-acceptance/交互系统.yaml`
- `code_design_sync_points`:
  - 用统一 command id 或 mode key 取代对 `VILLAGER_TOOLS` 索引和 `buildSubTool` 的硬编码依赖。
  - 重新定义菜单叶子命令到 `rect-selection` / `brush-stroke` / `single-cell`、`verb`、`sourceMode.source` 的映射。
  - 收敛 `GameScene`、`game-scene-floor-interaction.ts`、`build-domain-command.ts`、`interaction-mode-presenter.ts` 对当前命令状态的读取方式。
- `acceptance_sync_points`:
  - 通过菜单选择“区域 -> 存储区 -> 新建”“建造 -> 墙 -> 木墙”“家具 -> 木床”时，交互模式与输入形态正确切换。
  - 玩家提交后，`player-channel` 提示与实际提交到世界的命令一致。
  - 菜单重构后，旧的 build 墙/床链路不能回归。
- `recommended_first_test`: `tests/headless/ui-menu-mode-switch.test.ts`
- `blocked_by`:
  - 需要决定是保留现有 tool-based 命令层作兼容适配，还是直接切到 menu command id。
  - 需要确认哪些旧工具项会迁移进三级菜单，哪些仍保留热键直达或作为兼容别名。

### 3. 建筑系统

- `system`: 建筑系统
- `why_impacted`: 当前唯一已实现的层级入口主要落在 `木墙` 和 `木床`；三级菜单若调整命令路径，必须保证这两个叶子命令仍稳定映射到 `build_wall_blueprint` 与 `place_furniture:bed`。
- `upstream_docs_to_update`:
  - `oh-code-design/建筑系统.yaml`
  - `oh-acceptance/建筑系统.yaml`
- `code_design_sync_points`:
  - 确认“命令路径变化不等于建筑规则变化”，只同步墙/床命令入口与文案来源。
  - 检查 UI/交互不再把建筑命令写成单独特例。
- `acceptance_sync_points`:
  - `BUILD-001` 和 `BUILD-002` 的触发前置应更新为新菜单路径。
  - 墙体笔刷与床铺单格放置的输入差异必须保持不变。
- `recommended_first_test`: `tests/headless/build-wall-flow.test.ts`
- `blocked_by`:
  - 若三级菜单叶子集合改变，需先确认墙/床是否仍为稳定叶子，而不是继续挂在临时兼容别名下。

### 4. 地图系统

- `system`: 地图系统
- `why_impacted`: 仅在“区域 -> 存储区 -> 新建”这类菜单叶子会触发地图选区语义时受到间接影响；地图规则本身不需要因菜单形态重写。
- `upstream_docs_to_update`:
  - `oh-code-design/地图系统.yaml`
  - `oh-acceptance/地图系统.yaml`
- `code_design_sync_points`:
  - 同步地图系统接收的仍是选区结果，不直接感知 UI 菜单层级。
  - 若命令路径替换了旧 `zone-create`/toolbar source 命名，需要更新来源字段说明。
- `acceptance_sync_points`:
  - `MAP-002` 的前置应从旧模式名改为新菜单路径。
  - 存储区创建的地图边界反馈不应因菜单重构回归。
- `recommended_first_test`: `tests/headless/zone-create.test.ts`
- `blocked_by`:
  - 只有在三级菜单明确包含区域类命令时才需要同步；若首批只迁移建造命令，可降为登记依赖。

## 文档顺序

1. `oh-gen-doc/UI系统.yaml` + `oh-gen-doc/交互系统.yaml`
2. `oh-code-design/UI系统.yaml` + `oh-code-design/交互系统.yaml`
3. 仅对明确受路径变化影响的依赖系统补 `oh-code-design/建筑系统.yaml` / `oh-code-design/地图系统.yaml`
4. `oh-acceptance/UI系统.yaml` + `oh-acceptance/交互系统.yaml`
5. 依赖系统 acceptance 同步到新前置路径

## 实现前检查项

- 不再以 `scene-hud` / `villager-tool-bar` 作为历史系统路由目标，仍按 UI系统 + 交互系统推进。
- 不能继续让 `build` 保持 HUD 特例；三层菜单必须统一数据模型。
- 不能同时维护新命令状态和旧 `selectedToolIndex + buildSubTool` 作为两个真源。
