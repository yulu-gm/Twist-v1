# 系统注册表（权威键列表）

本表中的 `system` 列必须与 `docs/ai/index/system-index.json` 中的 `key` 集合一致。

| system | 职责摘要 | 标准文档 | aidoc 路径 | 默认 failing test | 主要依赖 |
| --- | --- | --- | --- | --- | --- |
| world-grid | 处理格子地图尺寸、格坐标、邻格、边界、出生点和占用快照 | docs/ai/system-standards/world-grid.md | docs/ai/systems/world-grid/ | domain | pawn-state, task-planning |
| selection-ui | 处理选中、焦点、高亮、可点击反馈和目标对象切换 | docs/ai/system-standards/selection-ui.md | docs/ai/systems/selection-ui/ | acceptance | scene-hud, pawn-state |
| scene-hud | 处理 HUD、状态卡、菜单、按钮和场景内信息展示 | docs/ai/system-standards/scene-hud.md | docs/ai/systems/scene-hud/ | component | selection-ui, pawn-state |
| pawn-state | 处理角色可读状态、属性、需求和 UI 所需派生字段 | docs/ai/system-standards/pawn-state.md | docs/ai/systems/pawn-state/ | domain | task-planning |
| task-planning | 处理目标评估、工作选择、任务计划和可执行动作候选 | docs/ai/system-standards/task-planning.md | docs/ai/systems/task-planning/ | domain | pawn-state |

## 注册表使用规则

- 主 agent 必须从本表读取标准文档路径，不要凭记忆猜。
- aidoc 新文件必须写入表中声明的目录。
- 如果本次需求涉及新系统，先扩充本表，再让 `route-demand` 使用它。
- 若系统存在，但本次需求不产生新承诺，可以只在主控需求单中标记为依赖系统。
