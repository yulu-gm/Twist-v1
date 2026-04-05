# 系统注册表（权威键列表）

本表中的 `system` 列必须与 `docs/ai/index/system-index.json` 中的 `key` **集合一致**（顺序不限）。

| system | 职责摘要 | 标准文档 | aidoc 路径 | 默认 failing test | 主要依赖 |
|---|---|---|---|---|---|
| world-grid | 格子地图尺寸、格坐标、邻格、边界、出生点、占用快照 | docs/ai/system-standards/world-grid.md | docs/ai/systems/world-grid/ | domain | pawn-state, task-planning |
| selection-ui | 选中、焦点、高亮、可点击反馈、目标切换 | docs/ai/system-standards/selection-ui.md | docs/ai/systems/selection-ui/ | acceptance | scene-hud, pawn-state |
| scene-hud | HUD、状态卡、菜单、按钮、场景内信息展示 | docs/ai/system-standards/scene-hud.md | docs/ai/systems/scene-hud/ | component | selection-ui, pawn-state |
| pawn-state | 角色可读状态、属性、需求、UI 派生字段 | docs/ai/system-standards/pawn-state.md | docs/ai/systems/pawn-state/ | domain | task-planning |
| task-planning | 目标评估、工作选择、任务计划、可执行动作候选 | docs/ai/system-standards/task-planning.md | docs/ai/systems/task-planning/ | domain | pawn-state |
