# selection-ui 系统入口

## 系统职责摘要

`selection-ui` 负责选中、高亮、焦点切换和目标对象切换反馈。当前运行时已拆成选区状态、渲染器和任务标记数据模块，玩家可见行为不变。

## 标准文档

- `docs/ai/system-standards/selection-ui.md`

## 当前关键实现文件

- `src/game/floor-selection.ts`
- `src/scenes/renderers/selection-renderer.ts`
- `src/data/task-markers.ts`
- `src/scenes/GameScene.ts`（仅负责布局、输入和状态 wiring）

## 当前关键测试文件

- `tests/domain/floor-selection.test.ts`

## 当前接入场景文件

- `src/scenes/GameScene.ts`（格子上的 **工具点格子** 的 mock 任务标记为点击反馈，规格见 **scene-hud** `2026-04-05-mock-task-markers-on-grid.md` 与集成 `2026-04-05-mock-task-markers-on-grid.md`）

## 最新/历史 aidoc

- `docs/ai/systems/selection-ui/2026-04-05-gamescene-runtime-refactor.md`
- `docs/ai/systems/selection-ui/2026-04-05-floor-area-selection-foundation.md`

## 何时必须回填

- 新增选中、高亮、焦点或者目标切换交互时，必须先补充路由的 aidoc。
- 如果实现文件、测试文件或者场景接入点出现，必须同步更新 `docs/ai/index/system-index.json`。
- 如果玩家路径发生变化，必须补充 `docs/ai/integration/`。
