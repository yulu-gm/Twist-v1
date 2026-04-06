# selection-ui 系统入口

## 系统职责摘要

`selection-ui` 负责选中、高亮、焦点切换和目标对象切换反馈。当前运行时已拆成选区状态、渲染器和任务标记数据模块，玩家可见行为不变。

## 路由桥接

- `routedSystems`：`UI系统`、`交互系统`、`地图系统`
- `lookupAliases`：`selection-ui`、`selection`、`floor-selection`、`brush`
- `sharedEntryFiles`：`src/game/interaction/index.ts`、`src/scenes/game-scene-floor-interaction.ts`、`src/scenes/renderers/selection-renderer.ts`

这页仍然是 legacy implementation lookup，不是 `route-demand` 的权威注册表。只要选区、高亮与地图交互继续复用这些入口，就继续在这里维护桥接字段。

## 标准文档

- `docs/ai/system-standards/selection-ui.md`

## 当前关键实现文件

- `src/game/interaction/floor-selection.ts`
- `src/player/brush-stroke.ts`、`src/player/tool-input-policy.ts`（建造笔刷路径与工具输入形态）
- `src/scenes/renderers/selection-renderer.ts`
- `src/data/task-markers.ts`
- `src/scenes/GameScene.ts`（仅负责布局、输入和状态 wiring）

## 当前关键测试文件

- `tests/domain/floor-selection.test.ts`
- `tests/component/mock-task-marker-selection.test.ts`
- `tests/data/task-markers-merge.test.ts`

## 当前接入场景文件

- `src/scenes/GameScene.ts`
- `src/scenes/game-scene-floor-interaction.ts`

## 最新/历史 aidoc

- `docs/ai/integration/2026-04-06-headless-obstacle-pathing-and-wall-flow.md`
- `docs/ai/systems/selection-ui/2026-04-05-gamescene-runtime-refactor.md`
- `docs/ai/systems/selection-ui/2026-04-05-floor-area-selection-foundation.md`
- `docs/ai/systems/selection-ui/2026-04-05-brush-and-gateway-ordered-commit.md`

## 何时必须回填

- 新增选中、高亮、焦点或者目标切换交互时，必须先补充路由的 aidoc。
- 如果实现文件、测试文件或者场景接入点出现，必须同步更新 `docs/ai/index/system-index.json`。
- 如果玩家路径发生变化，必须补充 `docs/ai/integration/`。
