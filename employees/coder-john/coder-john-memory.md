- 2026-04-07: 梳理并反复完善项目中 mock 表现层逻辑：覆盖废弃兼容前向文件（如 `mock-task-marker-commands.ts` 等）、正式系统接入场景（地图、实体、物品、AI 行为等），并在 `employees/coder-john/docs/mock-refactor-plan.md` 中汇总重构目标，含「选区与区域系统 (Selection & Zone System)」。对照 `src/` 内 mock/MOCK_/（mock）全文扫描复查后，文档七节（兼容前向、格子信息、地面物品、角色档案、HUD、任务/工具栏、选区）与现状一致，故未再改该文件。说明：`tests/component/mock-task-marker-*.test.ts` 仅在计划与 AI 文档中出现，当前 tests 目录下尚无对应文件。
  - 按 `employees/coder-john/docs/mock-refactor-plan.md` §1 删除已无源码引用的场景兼容前向 re-export 文件（运行时已全部改走 `src/data/*`）：`src/scenes/villager-tool-bar-config.ts`、`src/scenes/mock-villager-tools.ts`、`src/scenes/mock-ground-items.ts`、`src/scenes/mock-grid-cell-info.ts`、`src/scenes/mock-task-marker-commands.ts`、`src/scenes/mock-task-marker-selection.ts`、`src/scenes/mock-pawn-profile-data.ts`。

- 2026-04-07: 实现 `oh-code-design/UI系统.yaml` 对应的 UI 系统（菜单树 / 状态提示 / 地图叠加反馈），并对齐 `oh-acceptance/UI系统.yaml` 场景用例（UI-001~UI-005）。
  - 新增 `index.html` UI 容器与样式：左下角 `#command-menu` 指令菜单、`#mode-hint` 模式提示区，调整 `#grid-hover-info` 位置。
  - 新增 UI 菜单数据模型 `src/ui/command-menu.ts`：定义 `DEFAULT_COMMAND_MENU`、`CommandMenuState`、`CommandMenuLeafId`（覆盖指令、建造、区域等路径）。
  - 扩展 HUD DOM 封装 `src/ui/hud-manager.ts`：新增 `setupCommandMenu`、`showModeHint` 等方法，负责渲染菜单并触发选择回调。
  - 串联 GameScene 与 UI 系统 `src/scenes/GameScene.ts`：接入指令菜单，将菜单选择转为 UI 模式与模式提示；增加地图叠加反馈（交互点进度条叠加渲染、蓝图虚影预览、伐木工具选区内树木格描绿边等）；同步小人状态行（「建造中」等）；依据模式切换鼠标指针（十字准星等）。
  - 新增 `src/ui/ui-modes.ts`：导出 `UiInteractionMode`，下沉界面态类型。
  - 验证：执行 `npm run build` 通过。

- 2026-04-07：按 `employees/coder-john/coder-john.md` 工作规范做工作区自检并修复：
  - 发现并修正文案型“临时”注释：`src/data/ground-items.ts` 将“临时固定散落”调整为“固定散落（稳定 mock 布局）”，避免过程/临时措辞，但不改变逻辑与数据。
  - 将工作规范相关文件纳入版本控制：把 `employees/coder-john/*` 与 `employees/coder-john/docs/mock-refactor-plan.md` 以及新增 UI 文件 `src/ui/command-menu.ts`、`src/ui/ui-modes.ts` 进行跟踪。
  - 验证：执行 `npm run build` 通过。

- 2026-04-07：修正 UI 系统设计文档并落实菜单与工具栏重构：
  - 明确结构：左下角主菜单（1/2级），底部工具栏（3级具体工具），点击2级菜单动态展开工具栏。产出 `ui-menu-toolbar-refactor-plan.md`。
  - 数据模型：`src/ui/command-menu.ts` 拆分 `MainMenuState` 和 `ToolbarState`，新增 `TOOL_GROUPS` 映射。
  - HUD 封装：`src/ui/hud-manager.ts` 仅渲染至二级菜单，并支持按 `toolGroupId` 动态渲染工具栏。
  - 场景集成：`src/scenes/GameScene.ts` 监听二级菜单选择并更新工具栏，统一工具选择入口与交互模式切换。
  - 数据清理：`src/data/villager-tools.ts` 废弃静态 `VILLAGER_TOOLS`，保留快捷键；`task-markers.ts` 改用 `TOOL_GROUPS` 查找标签。
  - 验证：执行 `npm run build` 通过。
